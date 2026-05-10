"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import type { Order } from "../../../data/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function groupByPickupDate(orders: Order[]) {
  const groups: Record<string, Order[]> = {};
  for (const o of orders) {
    const key = o.pickupTime || todayStr();
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  }
  return groups;
}

export default function KitchenView({
  orders,
  locale,
  t,
}: {
  orders: Order[];
  locale: string;
  t: (key: string) => string;
}) {
  const [printMode, setPrintMode] = useState<"checklist" | "details" | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Only show pending + accepted orders for today/tomorrow
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === "pending" || o.status === "accepted"),
    [orders]
  );

  const grouped = useMemo(() => groupByPickupDate(activeOrders), [activeOrders]);
  const dates = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  // Count totals
  const totalOrders = activeOrders.length;
  const totalItems = activeOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  function handlePrint(mode: "checklist" | "details") {
    setPrintMode(mode);
  }

  // Trigger print after state update
  useEffect(() => {
    if (printMode) {
      // Small delay for DOM to render
      const timer = setTimeout(() => {
        window.print();
        setPrintMode(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [printMode]);

  return (
    <div className="mt-8">
      {/* Header stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("kitchen.title")}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {totalOrders} {t("kitchen.totalOrders")} · {totalItems}{" "}
            {t("kitchen.totalItems")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handlePrint("checklist")}
            className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            🖨️ {t("kitchen.printChecklist")}
          </button>
          <button
            type="button"
            onClick={() => handlePrint("details")}
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50"
          >
            🖨️ {t("kitchen.printDetails")}
          </button>
        </div>
      </div>

      {/* Orders grouped by pickup date */}
      {dates.length === 0 ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-stone-600">
          {t("kitchen.noOrders")}
        </p>
      ) : (
        dates.map((date) => (
          <div key={date} className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-800">{date}</h3>
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
                {grouped[date].length} {t("kitchen.orders")}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {grouped[date].map((order) => (
                <div
                  key={order.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    order.status === "pending"
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-emerald-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-stone-950">{order.id}</p>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          order.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {t(`order.${order.status}`)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-amber-800">
                      {formatCurrency(order.total)}
                    </p>
                  </div>

                  {/* Items list */}
                  <ul className="mt-3 space-y-1 border-t border-stone-200 pt-3">
                    {order.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-stone-700">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-stone-500">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Customer info */}
                  <div className="mt-3 border-t border-stone-200 pt-3 text-xs text-stone-600">
                    <p>
                      <span className="font-semibold text-stone-700">
                        {t("menu.contact")}:
                      </span>{" "}
                      {order.contact}
                    </p>
                    <p className="mt-1 truncate">
                      <span className="font-semibold text-stone-700">
                        {t("menu.address")}:
                      </span>{" "}
                      {order.address}
                    </p>
                    {order.notes && (
                      <p className="mt-1">
                        <span className="font-semibold text-stone-700">
                          {t("menu.notes")}:
                        </span>{" "}
                        {order.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Hidden print containers */}

      {/* Checklist print: compact table */}
      <div
        ref={printRef}
        className="print-only"
        style={{ display: printMode ? "block" : "none" }}
      >
        {printMode === "checklist" && (
          <div className="print-checklist p-4">
            <h1 className="mb-4 text-center text-xl font-bold">
              Kitchen Checklist — {todayStr()}
            </h1>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-stone-950 text-left">
                  <th className="p-2 font-bold">Order</th>
                  <th className="p-2 font-bold">Items</th>
                  <th className="p-2 font-bold">Contact</th>
                  <th className="p-2 font-bold">Pickup</th>
                  <th className="p-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order) => (
                  <tr key={order.id} className="border-b border-stone-300">
                    <td className="p-2 font-semibold">{order.id}</td>
                    <td className="p-2">
                      {order.items
                        .map((i) => `${i.quantity}x ${i.name}`)
                        .join(", ")}
                    </td>
                    <td className="p-2">{order.contact}</td>
                    <td className="p-2">{order.pickupTime || "—"}</td>
                    <td className="p-2">
                      {order.status === "pending" ? "Pending" : "Accepted"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Details print: each order as a card, 2 per page */}
        {printMode === "details" && (
          <div className="print-details p-4">
            <h1 className="mb-6 text-center text-lg font-bold">
              Order Details — {todayStr()}
            </h1>
            <div className="print-grid grid grid-cols-2 gap-4">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="break-inside-avoid rounded border border-stone-400 p-3"
                >
                  <div className="border-b border-stone-300 pb-2">
                    <p className="text-sm font-bold">{order.id}</p>
                    <p className="text-xs text-stone-600">
                      {order.pickupTime || "No date"}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span>
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-stone-200 pt-2 text-xs text-stone-600">
                    <p>
                      <strong>Contact:</strong> {order.contact}
                    </p>
                    <p>
                      <strong>Address:</strong> {order.address}
                    </p>
                    {order.notes && (
                      <p>
                        <strong>Notes:</strong> {order.notes}
                      </p>
                    )}
                    <p className="mt-1 font-bold">
                      Total: {formatCurrency(order.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-only,
          .print-only * {
            visibility: visible;
          }
          .print-only {
            position: fixed;
            inset: 0;
            overflow: auto;
            background: white;
          }
          .print-checklist table {
            page-break-after: auto;
          }
          .print-checklist tr {
            page-break-inside: avoid;
          }
          .print-details .print-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
}
