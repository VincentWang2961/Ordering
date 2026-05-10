"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LangProvider, useLang } from "../../contexts/LangContext";
import { getOrders, loadMenu, loadSettings } from "../../data/store";

const ADMIN_PASSWORD = "OrderingAdmin2026";

function AdminLogin() {
  const { t } = useLang();
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [menu] = useState(() => loadMenu());
  const [orders] = useState(() => getOrders());
  const [settings] = useState(() => loadSettings());

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setLoggedIn(true);
      setError("");
      return;
    }
    setError(t("admin.wrongPassword"));
  }

  return (
    <main className="min-h-screen bg-[oklch(0.97_0.025_77)] px-4 py-8 text-stone-950 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-amber-800">
          {t("common.back")}
        </Link>

        {!loggedIn ? (
          <form
            onSubmit={handleLogin}
            className="mx-auto mt-16 max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-amber-900/10"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800">
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
                className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-amber-600"
              />
            </label>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              className="mt-6 h-12 w-full rounded-xl bg-stone-950 px-5 font-semibold text-white hover:bg-stone-800"
            >
              {t("admin.loginBtn")}
            </button>
          </form>
        ) : (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-xl shadow-amber-900/10 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800">
                  {settings.name}
                </p>
                <h1 className="mt-2 text-3xl font-bold">{t("admin.title")}</h1>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoggedIn(false);
                  setPassword("");
                }}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold hover:bg-stone-50"
              >
                {t("admin.logout")}
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-amber-50 p-5">
                <p className="text-sm font-semibold text-stone-500">
                  {t("admin.menuManagement")}
                </p>
                <p className="mt-2 text-3xl font-bold">{menu.length}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-stone-500">
                  {t("admin.orderManagement")}
                </p>
                <p className="mt-2 text-3xl font-bold">{orders.length}</p>
              </div>
              <div className="rounded-2xl bg-stone-100 p-5">
                <p className="text-sm font-semibold text-stone-500">
                  {t("admin.contactInfo")}
                </p>
                <p className="mt-2 font-bold">{settings.contact}</p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold">{t("admin.orderManagement")}</h2>
              <div className="mt-4 divide-y divide-stone-200 rounded-2xl border border-stone-200">
                {orders.length === 0 ? (
                  <p className="p-4 text-stone-600">{t("order.noOrders")}</p>
                ) : (
                  orders.slice(0, 8).map((order) => (
                    <Link
                      key={order.id}
                      href={`/order/${order.id}`}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-amber-50"
                    >
                      <div>
                        <p className="font-semibold">{order.id}</p>
                        <p className="text-sm text-stone-600">
                          {order.items.length} {t("order.items")} ·{" "}
                          {order.status}
                        </p>
                      </div>
                      <p className="font-bold">${order.total.toFixed(2)}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <LangProvider>
      <AdminLogin />
    </LangProvider>
  );
}
