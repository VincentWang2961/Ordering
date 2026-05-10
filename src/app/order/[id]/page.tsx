"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LangProvider, useLang } from "../../../contexts/LangContext";
import { getOrder } from "../../../data/store";
import type { Order } from "../../../data/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function OrderDetails() {
  const params = useParams<{ id: string }>();
  const { t } = useLang();
  const [order, setOrder] = useState<Order | undefined>(undefined);

  useEffect(() => {
    setOrder(getOrder(params.id));
  }, [params.id]);

  return (
    <>
      <main className="min-h-screen bg-[oklch(0.97_0.025_77)] px-4 py-8 text-stone-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-amber-800">
          {t("common.back")}
        </Link>
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-xl shadow-amber-900/10 sm:p-8">
          {order ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800">
                    {t("order.title")}
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">{order.id}</h1>
                </div>
                <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
                  {t(`order.${order.status}`)}
                </span>
              </div>

              <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-stone-500">
                    {t("order.placedAt")}
                  </dt>
                  <dd className="mt-1">
                    {new Date(order.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-500">
                    {t("menu.selectTime")}
                  </dt>
                  <dd className="mt-1">{order.pickupTime}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-500">
                    {t("menu.contact")}
                  </dt>
                  <dd className="mt-1">{order.contact}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-500">
                    {t("menu.address")}
                  </dt>
                  <dd className="mt-1">{order.address}</dd>
                </div>
              </dl>

              <div className="mt-8">
                <h2 className="text-lg font-bold">{t("order.items")}</h2>
                <div className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200">
                  {order.items.map((item) => (
                    <div
                      key={item.menuId}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-stone-600">
                          {item.quantity} x {formatCurrency(item.price)}
                        </p>
                      </div>
                      <p className="font-bold">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {order.notes ? (
                <div className="mt-6 rounded-2xl bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-stone-500">
                    {t("menu.notes")}
                  </p>
                  <p className="mt-1">{order.notes}</p>
                </div>
              ) : null}

              <div className="mt-8 flex items-center justify-between rounded-2xl bg-stone-950 px-5 py-4 text-white">
                <span className="font-semibold">{t("order.total")}</span>
                <span className="text-2xl font-bold">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <h1 className="text-2xl font-bold">{t("order.noOrders")}</h1>
              <p className="mt-2 text-stone-600">{params.id}</p>
            </div>
          )}
        </section>
      </div>
    </main>
    <div className="bg-[oklch(0.97_0.025_77)] pb-[env(safe-area-inset-bottom)]" />
    </>
  );
}

export default function OrderPage() {
  return (
    <LangProvider>
      <OrderDetails />
    </LangProvider>
  );
}
