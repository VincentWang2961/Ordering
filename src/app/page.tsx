"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LangProvider, useLang } from "../contexts/LangContext";
import {
  createOrder,
  getOrdersAsync,
  loadMenuAsync,
  loadSettings,
  loadSettingsAsync,
} from "../data/store";
import type { MenuItem, Order, RestaurantSettings } from "../data/types";
import AddressInput from "./components/AddressInput";

type CartLine = {
  item: MenuItem;
  quantity: number;
};

type CheckoutForm = {
  pickupTime: string;
  address: string;
  contact: string;
  notes: string;
};

const languageOptions = [
  { locale: "en", label: "EN" },
  { locale: "zh-CN", label: "简体" },
  { locale: "zh-TW", label: "繁體" },
] as const;

function getDefaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

const initialForm: CheckoutForm = {
  pickupTime: getDefaultDate(),
  address: "",
  contact: "",
  notes: "",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function itemName(item: MenuItem, locale: string) {
  if (locale === "zh-CN") return item.nameZhCN || item.name;
  if (locale === "zh-TW") return item.nameZhTW || item.name;
  return item.name;
}

function itemDescription(item: MenuItem, locale: string) {
  if (locale === "zh-CN") return item.descriptionZhCN || item.description;
  if (locale === "zh-TW") return item.descriptionZhTW || item.description;
  return item.description;
}

function settingsName(settings: RestaurantSettings, locale: string) {
  if (locale === "zh-CN") return settings.nameZhCN || settings.name;
  if (locale === "zh-TW") return settings.nameZhTW || settings.name;
  return settings.name;
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function CustomerHome() {
  const { locale, setLocale, t } = useLang();
  const [settings] = useState(() => loadSettings());
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [liveSettings, setLiveSettings] = useState(settings);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [verifiedLat, setVerifiedLat] = useState<number | null>(null);
  const [verifiedLng, setVerifiedLng] = useState<number | null>(null);
  const [addressError, setAddressError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, line) => sum + line.item.price * line.quantity,
    0
  );
  const orderHistory = orderHistoryOpen ? orders : [];

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSettingsAsync(), loadMenuAsync(), getOrdersAsync()])
      .then(([nextSettings, nextMenu, nextOrders]) => {
        if (cancelled) return;
        setLiveSettings(nextSettings);
        setMenu(nextMenu.filter((item) => item.published));
        setOrders(nextOrders);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(menu.map((item) => item.category))),
    [menu]
  );

  function updateForm(field: keyof CheckoutForm, value: string) {
    if (field === "address") setAddressError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addToCart(item: MenuItem, amount = quantity) {
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id);
      if (!existing) return [...current, { item, quantity: amount }];
      return current.map((line) =>
        line.item.id === item.id
          ? { ...line, quantity: line.quantity + amount }
          : line
      );
    });
  }

  function changeCartQuantity(id: string, nextQuantity: number) {
    if (nextQuantity < 1) {
      setCart((current) => current.filter((line) => line.item.id !== id));
      return;
    }

    setCart((current) =>
      current.map((line) =>
        line.item.id === id ? { ...line, quantity: nextQuantity } : line
      )
    );
  }

  function handlePanelOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) return;

    if (!verifiedLat || !verifiedLng) {
      setAddressError(t("address.notFound"));
      return;
    }

    const existingCart = cart.filter((line) => line.item.id !== selectedItem.id);
    const orderCart = [
      ...existingCart,
      { item: selectedItem, quantity },
    ];
    void placeOrder(orderCart);
  }

  function handleCartOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0) return;

    if (!verifiedLat || !verifiedLng) {
      setAddressError(t("address.notFound"));
      return;
    }

    void placeOrder(cart);
  }

  async function placeOrder(lines: CartLine[]) {
    const total = lines.reduce(
      (sum, line) => sum + line.item.price * line.quantity,
      0
    );
    const order = await createOrder({
      items: lines.map((line) => ({
        menuId: line.item.id,
        name: itemName(line.item, locale),
        quantity: line.quantity,
        price: line.item.price,
      })),
      total,
      pickupTime: form.pickupTime,
      address: form.address,
      lat: verifiedLat ?? undefined,
      lng: verifiedLng ?? undefined,
      contact: form.contact,
      notes: form.notes,
    });

    setCreatedOrder(order);
    setOrders(await getOrdersAsync());
    setCart([]);
    setSelectedItem(null);
    setCartOpen(false);
    setQuantity(1);
    setForm(initialForm);
    setVerifiedLat(null);
    setVerifiedLng(null);
    setAddressError("");
  }

  return (
    <>
    <main className="min-h-screen bg-[#f0e8dc] pb-28 text-stone-950">
      <header className="sticky top-0 z-30 border-b border-amber-900/10 bg-[#faf5ed]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-xl font-semibold text-amber-950">
            {settingsName(liveSettings, locale)}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <div className="flex rounded-full border border-amber-900/15 bg-white p-1">
              {languageOptions.map((option) => (
                <button
                  key={option.locale}
                  type="button"
                  onClick={() => setLocale(option.locale)}
                  className={`rounded-full px-3 py-1.5 transition ${
                    locale === option.locale
                      ? "bg-amber-700 text-white"
                      : "text-stone-600 hover:bg-amber-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOrderHistoryOpen(true)}
              className="rounded-full px-4 py-2 text-stone-700 hover:bg-white"
            >
              {t("nav.myOrder")}
            </button>
            <Link
              href="/admin"
              className="rounded-full bg-stone-950 px-4 py-2 text-white shadow-sm hover:bg-stone-800"
            >
              {t("nav.admin")}
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <p className="mb-4 w-fit rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            {liveSettings.contact}
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-stone-950 sm:text-7xl">
            Ordering
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            {t("home.subtitle")} with fresh dishes, simple pickup scheduling,
            and quick order tracking.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-amber-900/15 bg-white px-4 py-2 text-sm text-stone-700"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
        <div className="min-h-80 overflow-hidden rounded-[2rem] bg-amber-900 shadow-2xl shadow-amber-900/20">
          <img
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80"
            alt="Restaurant table with shared dishes"
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800">
              {t("home.browseMenu")}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-stone-950">
              {t("menu.title")}
            </h2>
          </div>
          <p className="hidden text-sm text-stone-600 sm:block">
            {menu.length} items available
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {menu.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedItem(item);
                setQuantity(1);
              }}
              className="group overflow-hidden rounded-2xl border border-amber-900/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-900/10"
            >
              <div className="aspect-[4/3] overflow-hidden bg-amber-50">
                <img
                  src={item.image}
                  alt={itemName(item, locale)}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-stone-950">
                    {itemName(item, locale)}
                  </h3>
                  <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    {item.category}
                  </span>
                </div>
                <p className="line-clamp-2 min-h-12 text-sm leading-6 text-stone-600">
                  {itemDescription(item, locale)}
                </p>
                <p className="mt-4 text-xl font-bold text-amber-800">
                  {formatCurrency(item.price)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-40 flex items-end bg-stone-950/45 p-0 sm:items-center sm:justify-center sm:p-6">
          <form
            onSubmit={handlePanelOrder}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                  {selectedItem.category}
                </span>
                <h2 className="mt-3 text-2xl font-bold">
                  {itemName(selectedItem, locale)}
                </h2>
                <p className="mt-2 text-stone-600">
                  {itemDescription(selectedItem, locale)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  {t("menu.quantity")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Number(event.target.value)))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-amber-600"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  {t("menu.selectTime")}
                </span>
                <input
                  type="date"
                  required
                  value={form.pickupTime}
                  onChange={(event) =>
                    updateForm("pickupTime", event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-amber-600"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-stone-700">
                  {t("menu.address")}
                </span>
                <AddressInput
                  value={form.address}
                  onChange={(v) => updateForm("address", v)}
                  onVerified={(lat, lng) => {
                    setVerifiedLat(lat);
                    setVerifiedLng(lng);
                  }}
                  placeholder={liveSettings.pickupAddress}
                  t={t}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-stone-700">
                  {t("menu.contact")}
                </span>
                <input
                  required
                  value={form.contact}
                  onChange={(event) => updateForm("contact", event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-amber-600"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-stone-700">
                  {t("menu.notes")}
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-amber-600"
                />
              </label>
            </div>

            {addressError && (
              <p className="mt-3 text-sm font-medium text-red-500">
                {addressError}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  addToCart(selectedItem);
                  setSelectedItem(null);
                }}
                className="h-12 flex-1 rounded-xl border border-amber-700 px-5 font-semibold text-amber-800 hover:bg-amber-50"
              >
                {t("menu.addToOrder")}
              </button>
              <button
                type="submit"
                className="h-12 flex-1 rounded-xl bg-amber-700 px-5 font-semibold text-white shadow-sm hover:bg-amber-800"
              >
                {t("menu.placeOrder")} -{" "}
                {formatCurrency(selectedItem.price * quantity)}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {cartOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-stone-950/45 sm:items-center sm:justify-center sm:p-6">
          <form
            onSubmit={handleCartOrder}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t("order.title")}</h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {cart.length === 0 ? (
                <p className="rounded-xl bg-amber-50 p-4 text-stone-600">
                  {t("order.noOrders")}
                </p>
              ) : (
                cart.map((line) => (
                  <div
                    key={line.item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3"
                  >
                    <div>
                      <p className="font-semibold">{itemName(line.item, locale)}</p>
                      <p className="text-sm text-stone-600">
                        {formatCurrency(line.item.price)}
                      </p>
                    </div>
                    <input
                      aria-label={`${itemName(line.item, locale)} quantity`}
                      type="number"
                      min="0"
                      value={line.quantity}
                      onChange={(event) =>
                        changeCartQuantity(
                          line.item.id,
                          Number(event.target.value)
                        )
                      }
                      className="h-11 w-20 rounded-xl border border-stone-200 px-3"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <input
                type="date"
                required
                value={form.pickupTime}
                onChange={(event) => updateForm("pickupTime", event.target.value)}
                className="h-12 rounded-xl border border-stone-200 px-4 outline-none focus:border-amber-600"
              />
              <input
                required
                placeholder={t("menu.contact")}
                value={form.contact}
                onChange={(event) => updateForm("contact", event.target.value)}
                className="h-12 rounded-xl border border-stone-200 px-4 outline-none focus:border-amber-600"
              />
              <AddressInput
                value={form.address}
                onChange={(v) => updateForm("address", v)}
                onVerified={(lat, lng) => {
                  setVerifiedLat(lat);
                  setVerifiedLng(lng);
                }}
                placeholder={liveSettings.pickupAddress}
                t={t}
              />
              <textarea
                placeholder={t("menu.notes")}
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={3}
                className="rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-amber-600 sm:col-span-2"
              />
            </div>

            {addressError && (
              <p className="mt-3 text-sm font-medium text-red-500">
                {addressError}
              </p>
            )}
            <button
              type="submit"
              disabled={cart.length === 0}
              className="mt-5 h-12 w-full rounded-xl bg-amber-700 px-5 font-semibold text-white shadow-sm hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {t("menu.placeOrder")} - {formatCurrency(cartTotal)}
            </button>
          </form>
        </div>
      ) : null}

      {orderHistoryOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-stone-950/45 sm:items-center sm:justify-center sm:p-6">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t("order.history")}</h2>
              <button
                type="button"
                onClick={() => setOrderHistoryOpen(false)}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {orderHistory.length === 0 ? (
                <p className="rounded-xl bg-amber-50 p-4 text-stone-600">
                  {t("order.noOrders")}
                </p>
              ) : (
                orderHistory.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{order.id}</p>
                        <p className="mt-1 text-sm text-stone-600">
                          {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                        {t(`order.${order.status}`)}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-stone-600">
                        <span className="font-semibold text-stone-950">
                          {formatCurrency(order.total)}
                        </span>{" "}
                        · {order.items.length}{" "}
                        {order.items.length === 1 ? "item" : "items"}
                      </div>
                      <Link
                        href={`/order/${order.id}`}
                        className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {createdOrder ? (
        <div className="fixed inset-x-4 top-24 z-50 mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl">
          <p className="font-semibold text-emerald-800">{t("common.success")}</p>
          <p className="mt-1 text-sm text-stone-700">
            {t("order.orderNumber")}:{" "}
            <span className="font-semibold">{createdOrder.id}</span>
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/order/${createdOrder.id}`}
              className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
            >
              View order
            </Link>
            <button
              type="button"
              onClick={() => setCreatedOrder(null)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-3xl items-center justify-between rounded-full bg-stone-950 px-6 py-3 text-white shadow-2xl shadow-stone-950/25"
      >
        <span className="flex items-center gap-2 text-sm">
          <span className="font-semibold">
            {cartCount} {cartCount === 1 ? "item" : "items"}
          </span>
          <span className="text-amber-100/40">·</span>
          <span className="text-base font-bold">{formatCurrency(cartTotal)}</span>
        </span>
        <span className="rounded-full bg-amber-600 px-5 py-1.5 text-sm font-semibold">
          {t("order.title")}
        </span>
      </button>
    </main>

      <footer className="bg-[#f0e8dc] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-3 text-center text-xs text-stone-500 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} Ordering System
        </div>
      </footer>
    </>
  );
}

export default function Home() {
  return (
    <LangProvider>
      <CustomerHome />
    </LangProvider>
  );
}
