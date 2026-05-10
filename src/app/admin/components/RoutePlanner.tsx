"use client";

import { useState, useEffect } from "react";
import type { Order } from "../../../data/types";
import RouteMap from "./RouteMap";

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteStop {
  index: number;
  address: string;
  lat: number;
  lng: number;
  label: string;
}

interface RouteResult {
  stops: RouteStop[];
  totalDistance: string;
  totalDuration: string;
  orderSummary: string[];
  _mock?: boolean;
}

const STOP_ICONS = ["🏁", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

function buildGoogleMapsUrl(stops: RouteStop[]): string {
  const parts = stops.map((s) => encodeURIComponent(s.address));
  return `https://www.google.com/maps/dir/${parts.join("/")}`;
}

export default function RoutePlanner({
  orders,
  restaurantAddress,
  locale,
  t,
}: {
  orders: Order[];
  restaurantAddress: string;
  locale: string;
  t: (key: string) => string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-select accepted orders
  useEffect(() => {
    const accepted = orders.filter((o) => o.status === "accepted");
    setSelectedIds(new Set(accepted.map((o) => o.id)));
  }, [orders]);

  const acceptedOrders = orders.filter((o) => o.status === "accepted");

  function toggleOrder(id: string) {
    setRouteResult(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function calculateRoute() {
    setError("");
    setRouteResult(null);

    const selectedOrders = acceptedOrders.filter((o) => selectedIds.has(o.id));
    if (selectedOrders.length === 0) {
      setError(t("route.selectAtLeastOne"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantAddress,
          orderAddresses: selectedOrders.map((o) => o.address),
          orderLabels: selectedOrders.map((o) => `#${o.id} — ${o.contact}`),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to calculate route");
      } else {
        setRouteResult(data);
      }
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  const gmapsUrl = routeResult
    ? buildGoogleMapsUrl(routeResult.stops)
    : null;

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold">{t("route.title")}</h2>
      <p className="mt-2 text-sm text-stone-600">{t("route.description")}</p>

      {/* Restaurant address display */}
      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-stone-500">
          {t("route.startPoint")}
        </h3>
        <p className="mt-2 font-medium text-stone-950">{restaurantAddress}</p>
      </div>

      {/* Order selection */}
      <div className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-stone-700">
          {t("route.selectOrders")} ({selectedIds.size} /{" "}
          {acceptedOrders.length} {t("route.selected")})
        </h3>

        {acceptedOrders.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-stone-600">
            {t("route.noAcceptedOrders")}
          </p>
        ) : (
          <div className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            {acceptedOrders.map((order) => (
              <label
                key={order.id}
                className={`flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-amber-50 ${
                  selectedIds.has(order.id) ? "bg-amber-50/60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(order.id)}
                  onChange={() => toggleOrder(order.id)}
                  className="h-5 w-5 accent-stone-950"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-950">
                    #{order.id}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-stone-600">
                    {order.address}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}{" "}
                    · {order.contact}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  {t(`order.${order.status}`)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Calculate button */}
      <button
        type="button"
        onClick={calculateRoute}
        disabled={selectedIds.size === 0 || loading}
        className="mt-6 w-full rounded-xl bg-stone-950 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {loading
          ? t("route.calculating") + "…"
          : t("route.calculate")}
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Results */}
      {routeResult && (
        <div className="mt-8">
          {/* Summary stats */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl bg-emerald-50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-lg">📏</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t("route.totalDistance")}
                </p>
                <p className="text-lg font-bold text-emerald-900">
                  {routeResult.totalDistance}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t("route.estimatedTime")}
                </p>
                <p className="text-lg font-bold text-emerald-900">
                  {routeResult.totalDuration}
                </p>
              </div>
            </div>
            {routeResult._mock && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {t("route.demoMode")}
              </span>
            )}
          </div>

          {/* Map preview */}
          {!routeResult._mock && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-stone-700">
                {t("route.map")}
              </h3>
              <RouteMap
                stops={routeResult.stops}
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
                t={t}
              />
            </div>
          )}

          {/* Open in Google Maps button */}
          {gmapsUrl && (
            <a
              href={gmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {t("route.openInMaps")}
            </a>
          )}

          {/* Route order list */}
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-stone-700">
              {t("route.routeOrder")}
            </h3>
            {routeResult.stops.map((stop, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  i === 0
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 text-xl font-bold text-stone-600">
                    {STOP_ICONS[i] || `#${i}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-950">
                      {i === 0
                        ? t("route.startFrom")
                        : `${t("route.deliverTo")} #${stop.index}`}
                    </p>
                    <p className="mt-1 truncate text-sm text-stone-600">
                      {stop.label}
                    </p>
                    {i > 0 && (
                      <p className="mt-0.5 text-xs text-stone-500">
                        {routeResult.orderSummary[i]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
