"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { LangProvider, useLang } from "../../contexts/LangContext";
import {
  getOrders,
  loadMenu,
  saveMenu,
  loadSettings,
  saveSettings,
  updateOrderStatus,
} from "../../data/store";
import { MenuItem, Order } from "../../data/types";
import RoutePlanner from "./components/RoutePlanner";

const ADMIN_PASSWORD = "OrderingAdmin2026";

type AdminTab = "dashboard" | "menu" | "orders" | "routes";

type MenuFormState = {
  id: string;
  name: string;
  nameZhCN: string;
  nameZhTW: string;
  description: string;
  descriptionZhCN: string;
  descriptionZhTW: string;
  price: string;
  image: string;
  category: string;
  published: boolean;
  startDate: string;
  endDate: string;
  availableDays: number[];
};

const languageOptions = [
  { locale: "en", labelKey: "common.langEn" },
  { locale: "zh-CN", labelKey: "common.langZhCN" },
  { locale: "zh-TW", labelKey: "common.langZhTW" },
] as const;

const dayOptions = [
  { value: 1, key: "admin.mon" },
  { value: 2, key: "admin.tue" },
  { value: 3, key: "admin.wed" },
  { value: 4, key: "admin.thu" },
  { value: 5, key: "admin.fri" },
  { value: 6, key: "admin.sat" },
  { value: 0, key: "admin.sun" },
];

function emptyMenuForm(): MenuFormState {
  return {
    id: "",
    name: "",
    nameZhCN: "",
    nameZhTW: "",
    description: "",
    descriptionZhCN: "",
    descriptionZhTW: "",
    price: "",
    image: "",
    category: "",
    published: true,
    startDate: "",
    endDate: "",
    availableDays: [],
  };
}

function formFromItem(item: MenuItem): MenuFormState {
  return {
    id: item.id,
    name: item.name,
    nameZhCN: item.nameZhCN,
    nameZhTW: item.nameZhTW,
    description: item.description,
    descriptionZhCN: item.descriptionZhCN,
    descriptionZhTW: item.descriptionZhTW,
    price: String(item.price),
    image: item.image,
    category: item.category,
    published: item.published,
    startDate: item.availableDateRange?.start ?? "",
    endDate: item.availableDateRange?.end ?? "",
    availableDays: item.availableDays ?? [],
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function menuName(item: MenuItem, locale: string) {
  if (locale === "zh-CN") return item.nameZhCN || item.name;
  if (locale === "zh-TW") return item.nameZhTW || item.name;
  return item.name;
}

function settingsName(settings: ReturnType<typeof loadSettings>, locale: string) {
  if (locale === "zh-CN") return settings.nameZhCN || settings.name;
  if (locale === "zh-TW") return settings.nameZhTW || settings.name;
  return settings.name;
}

function statusBadgeClass(status: Order["status"]) {
  if (status === "accepted") return "bg-emerald-100 text-emerald-800";
  if (status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

function publishedBadgeClass(published: boolean) {
  return published
    ? "bg-emerald-100 text-emerald-800"
    : "bg-red-100 text-red-800";
}

function AdminDashboard() {
  const { locale, setLocale, t } = useLang();
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [menu, setMenu] = useState<MenuItem[]>(() => loadMenu());
  const [orders, setOrders] = useState<Order[]>(() => getOrders());
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState<MenuFormState | null>(null);

  const pendingOrders = orders.filter((order) => order.status === "pending");
  const publishedItems = menu.filter((item) => item.published);
  const categories = useMemo(
    () => Array.from(new Set(menu.map((item) => item.category).filter(Boolean))),
    [menu]
  );

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setLoggedIn(true);
      setError("");
      setMenu(loadMenu());
      setOrders(getOrders());
      setSettings(loadSettings());
      return;
    }
    setError(t("admin.wrongPassword"));
  }

  function persistMenu(nextMenu: MenuItem[]) {
    setMenu(nextMenu);
    saveMenu(nextMenu);
  }

  function openNewItemForm() {
    setEditingItem(null);
    setMenuForm(emptyMenuForm());
  }

  function openEditItemForm(item: MenuItem) {
    setEditingItem(item);
    setMenuForm(formFromItem(item));
  }

  function closeMenuForm() {
    setEditingItem(null);
    setMenuForm(null);
  }

  function updateMenuForm<K extends keyof MenuFormState>(
    field: K,
    value: MenuFormState[K]
  ) {
    setMenuForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function toggleAvailableDay(day: number) {
    setMenuForm((current) => {
      if (!current) return current;
      const hasDay = current.availableDays.includes(day);
      return {
        ...current,
        availableDays: hasDay
          ? current.availableDays.filter((value) => value !== day)
          : [...current.availableDays, day],
      };
    });
  }

  function handleSaveMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menuForm) return;

    const item: MenuItem = {
      id: menuForm.id || `item-${Date.now()}`,
      name: menuForm.name.trim(),
      nameZhCN: menuForm.nameZhCN.trim(),
      nameZhTW: menuForm.nameZhTW.trim(),
      description: menuForm.description.trim(),
      descriptionZhCN: menuForm.descriptionZhCN.trim(),
      descriptionZhTW: menuForm.descriptionZhTW.trim(),
      price: Number(menuForm.price) || 0,
      image: menuForm.image.trim(),
      category: menuForm.category.trim(),
      published: menuForm.published,
      availableDateRange:
        menuForm.startDate || menuForm.endDate
          ? { start: menuForm.startDate, end: menuForm.endDate }
          : undefined,
      availableDays:
        menuForm.availableDays.length > 0 ? menuForm.availableDays : undefined,
    };

    const nextMenu = editingItem
      ? menu.map((current) => (current.id === editingItem.id ? item : current))
      : [item, ...menu];
    persistMenu(nextMenu);
    closeMenuForm();
  }

  function handleDeleteItem(item: MenuItem) {
    if (!window.confirm(t("admin.confirmDelete"))) return;
    persistMenu(menu.filter((current) => current.id !== item.id));
  }

  function handleOrderStatus(id: string, status: "accepted" | "cancelled") {
    updateOrderStatus(id, status);
    setOrders(getOrders());
  }

  function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSettings(settings);
    setSettingsSaved(true);
    window.setTimeout(() => setSettingsSaved(false), 1800);
  }

  function availabilityText(item: MenuItem) {
    const range = item.availableDateRange;
    const rangeLabel =
      range?.start || range?.end
        ? `${range.start || t("admin.anyDate")} - ${range.end || t("admin.anyDate")}`
        : t("admin.noDateLimit");
    const daysLabel =
      item.availableDays && item.availableDays.length > 0
        ? dayOptions
            .filter((day) => item.availableDays?.includes(day.value))
            .map((day) => t(day.key))
            .join(", ")
        : t("admin.everyDay");
    return `${rangeLabel} | ${daysLabel}`;
  }

  const tabs = [
    { id: "dashboard" as const, label: t("admin.dashboard") },
    { id: "menu" as const, label: t("admin.menuManagement") },
    { id: "orders" as const, label: t("admin.orderManagement") },
    { id: "routes" as const, label: t("route.title") },
  ];

  return (
    <>
      <main className="min-h-screen bg-[#f2ebde] text-stone-950">
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-bold text-stone-950">
            {settingsName(settings, locale)}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-1 text-sm">
              {languageOptions.map((option) => (
                <button
                  key={option.locale}
                  type="button"
                  onClick={() => setLocale(option.locale)}
                  className={`rounded-md px-3 py-1.5 font-semibold ${
                    locale === option.locale
                      ? "bg-stone-950 text-white"
                      : "text-stone-600 hover:bg-white"
                  }`}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
            {loggedIn ? (
              <button
                type="button"
                onClick={() => {
                  setLoggedIn(false);
                  setPassword("");
                  setActiveTab("dashboard");
                }}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-50"
              >
                {t("admin.logout")}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {!loggedIn ? (
        <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <form
            onSubmit={handleLogin}
            className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
              {t("admin.title")}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{t("admin.login")}</h1>
            <label className="mt-8 block">
              <span className="text-sm font-medium text-stone-700">
                {t("admin.password")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-stone-300 px-4 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              className="mt-6 h-12 w-full rounded-lg bg-stone-950 px-5 font-semibold text-white hover:bg-stone-800"
            >
              {t("admin.loginBtn")}
            </button>
          </form>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                {t("admin.title")}
              </p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                {t("admin.dashboard")}
              </h1>
            </div>
          </div>

          <div className="mt-6 border-b border-stone-200">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "border-stone-950 text-stone-950"
                      : "border-transparent text-stone-500 hover:text-stone-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "dashboard" ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-stone-500">
                    {t("admin.menuCount")}
                  </p>
                  <p className="mt-3 text-4xl font-bold">{menu.length}</p>
                  <p className="mt-2 text-sm text-stone-500">
                    {publishedItems.length} {t("admin.published")}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-stone-500">
                    {t("admin.orderCount")}
                  </p>
                  <p className="mt-3 text-4xl font-bold">{orders.length}</p>
                  <p className="mt-2 text-sm text-stone-500">
                    {pendingOrders.length} {t("order.pending")}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-stone-500">
                    {t("admin.categoryCount")}
                  </p>
                  <p className="mt-3 text-4xl font-bold">{categories.length}</p>
                  <p className="mt-2 text-sm text-stone-500">
                    {t("admin.contactInfo")}: {settings.contact}
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleSettingsSubmit}
                className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-lg font-bold">{t("admin.contactInfo")}</h2>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-stone-700">
                    {t("admin.restaurantName")}
                  </span>
                  <input
                    value={settings.name}
                    onChange={(event) =>
                      setSettings({ ...settings, name: event.target.value })
                    }
                    className="mt-2 h-11 w-full rounded-lg border border-stone-300 px-3 outline-none focus:border-amber-700"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-stone-700">
                    {t("admin.pickupAddress")}
                  </span>
                  <input
                    value={settings.pickupAddress}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        pickupAddress: event.target.value,
                      })
                    }
                    className="mt-2 h-11 w-full rounded-lg border border-stone-300 px-3 outline-none focus:border-amber-700"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-stone-700">
                    {t("admin.contactInfo")}
                  </span>
                  <input
                    value={settings.contact}
                    onChange={(event) =>
                      setSettings({ ...settings, contact: event.target.value })
                    }
                    className="mt-2 h-11 w-full rounded-lg border border-stone-300 px-3 outline-none focus:border-amber-700"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-5 rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                >
                  {settingsSaved ? t("common.success") : t("admin.save")}
                </button>
              </form>
            </div>
          ) : null}

          {activeTab === "menu" ? (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">{t("admin.menuManagement")}</h2>
                <button
                  type="button"
                  onClick={openNewItemForm}
                  className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                >
                  {t("admin.addNewItem")}
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                {menu.length === 0 ? (
                  <p className="p-5 text-stone-600">{t("admin.noMenuItems")}</p>
                ) : (
                  <div className="divide-y divide-stone-200">
                    {menu.map((item) => (
                      <article
                        key={item.id}
                        className="grid gap-4 p-5 lg:grid-cols-[1fr_160px_140px]"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">
                              {menuName(item, locale)}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${publishedBadgeClass(
                                item.published
                              )}`}
                            >
                              {item.published
                                ? t("admin.published")
                                : t("admin.unpublished")}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-1 text-sm text-stone-600">
                            <p>
                              {t("admin.nameEn")}: {item.name}
                            </p>
                            <p>
                              {t("admin.nameZhCN")}: {item.nameZhCN}
                            </p>
                            <p>
                              {t("admin.nameZhTW")}: {item.nameZhTW}
                            </p>
                            <p>
                              {t("admin.availability")}: {availabilityText(item)}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm">
                          <p className="font-semibold">{item.category}</p>
                          <p className="mt-2 text-lg font-bold">
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                        <div className="flex items-start gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => openEditItemForm(item)}
                            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold hover:bg-stone-50"
                          >
                            {t("admin.editItem")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                          >
                            {t("admin.deleteItem")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "orders" ? (
            <div className="mt-8">
              <h2 className="text-2xl font-bold">{t("admin.orderManagement")}</h2>
              <div className="mt-5 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                {orders.length === 0 ? (
                  <p className="p-5 text-stone-600">{t("order.noOrders")}</p>
                ) : (
                  <div className="divide-y divide-stone-200">
                    {orders.map((order) => (
                      <article key={order.id} className="p-5">
                        <div className="grid gap-4 xl:grid-cols-[1fr_180px_220px]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold">{order.id}</h3>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(
                                  order.status
                                )}`}
                              >
                                {t(`order.${order.status}`)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-stone-600">
                              {order.items
                                .map(
                                  (item) =>
                                    `${item.quantity} ${t("admin.qty")} ${
                                      item.name
                                    } (${formatCurrency(
                                      item.price
                                    )})`
                                )
                                .join(", ")}
                            </p>
                            <dl className="mt-4 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
                              <div>
                                <dt className="font-semibold text-stone-800">
                                  {t("menu.address")}
                                </dt>
                                <dd>{order.address}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-stone-800">
                                  {t("menu.contact")}
                                </dt>
                                <dd>{order.contact}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-stone-800">
                                  {t("menu.selectTime")}
                                </dt>
                                <dd>{order.pickupTime}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-stone-800">
                                  {t("menu.notes")}
                                </dt>
                                <dd>{order.notes || t("admin.noNotes")}</dd>
                              </div>
                            </dl>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-stone-500">
                              {t("order.placedAt")}
                            </p>
                            <p className="mt-1 font-semibold">
                              {formatDate(order.createdAt)}
                            </p>
                            <p className="mt-4 text-sm font-semibold text-stone-500">
                              {t("order.total")}
                            </p>
                            <p className="mt-1 text-xl font-bold">
                              {formatCurrency(order.total)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-start gap-2 xl:justify-end">
                            {order.status === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOrderStatus(order.id, "accepted")
                                  }
                                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                >
                                  {t("admin.markAccepted")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOrderStatus(order.id, "cancelled")
                                  }
                                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                                >
                                  {t("admin.markCancelled")}
                                </button>
                              </>
                            ) : (
                              <span className="text-sm font-semibold text-stone-500">
                                {t("admin.noActions")}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "routes" ? (
            <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <RoutePlanner
                orders={orders}
                restaurantAddress={settings.pickupAddress}
                locale={locale}
                t={t}
              />
            </section>
          ) : null}
        </section>
      )}

      {menuForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/40 px-4 py-8">
          <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">
                {editingItem ? t("admin.editItem") : t("admin.addNewItem")}
              </h2>
              <button
                type="button"
                onClick={closeMenuForm}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold hover:bg-stone-50"
              >
                {t("admin.cancel")}
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="mt-6 grid gap-5">
              <div className="grid gap-4 md:grid-cols-3">
                <TextField
                  label={t("admin.nameEn")}
                  value={menuForm.name}
                  onChange={(value) => updateMenuForm("name", value)}
                  required
                />
                <TextField
                  label={t("admin.nameZhCN")}
                  value={menuForm.nameZhCN}
                  onChange={(value) => updateMenuForm("nameZhCN", value)}
                />
                <TextField
                  label={t("admin.nameZhTW")}
                  value={menuForm.nameZhTW}
                  onChange={(value) => updateMenuForm("nameZhTW", value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <TextArea
                  label={t("admin.descriptionEn")}
                  value={menuForm.description}
                  onChange={(value) => updateMenuForm("description", value)}
                />
                <TextArea
                  label={t("admin.descriptionZhCN")}
                  value={menuForm.descriptionZhCN}
                  onChange={(value) => updateMenuForm("descriptionZhCN", value)}
                />
                <TextArea
                  label={t("admin.descriptionZhTW")}
                  value={menuForm.descriptionZhTW}
                  onChange={(value) => updateMenuForm("descriptionZhTW", value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <TextField
                  label={t("menu.price")}
                  type="number"
                  value={menuForm.price}
                  onChange={(value) => updateMenuForm("price", value)}
                  required
                />
                <TextField
                  label={t("admin.image")}
                  value={menuForm.image}
                  onChange={(value) => updateMenuForm("image", value)}
                />
                <TextField
                  label={t("admin.categoryLabel")}
                  value={menuForm.category}
                  onChange={(value) => updateMenuForm("category", value)}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-stone-200 p-4">
                  <p className="font-semibold">{t("admin.availableDateRange")}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={t("admin.startDate")}
                      type="date"
                      value={menuForm.startDate}
                      onChange={(value) => updateMenuForm("startDate", value)}
                    />
                    <TextField
                      label={t("admin.endDate")}
                      type="date"
                      value={menuForm.endDate}
                      onChange={(value) => updateMenuForm("endDate", value)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 p-4">
                  <p className="font-semibold">{t("admin.availableDays")}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {dayOptions.map((day) => (
                      <label
                        key={day.value}
                        className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={menuForm.availableDays.includes(day.value)}
                          onChange={() => toggleAvailableDay(day.value)}
                          className="h-4 w-4 accent-stone-950"
                        />
                        <span>{t(day.key)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex w-fit items-center gap-3 rounded-lg border border-stone-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={menuForm.published}
                  onChange={(event) =>
                    updateMenuForm("published", event.target.checked)
                  }
                  className="h-4 w-4 accent-stone-950"
                />
                <span className="text-sm font-semibold">{t("admin.published")}</span>
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeMenuForm}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50"
                >
                  {t("admin.cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-stone-950 px-5 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                >
                  {t("admin.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
    {/* Safe area bottom spacer */}
    <div className="bg-[#f2ebde] pb-[env(safe-area-inset-bottom)]" />
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-stone-300 px-3 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
}

export default function AdminPage() {
  return (
    <LangProvider>
      <AdminDashboard />
    </LangProvider>
  );
}
