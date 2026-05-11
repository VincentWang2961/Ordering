"use client";

import { useState, useEffect } from "react";
import type { Order } from "../../../data/types";
import { updateOrderStatus } from "../../../data/store";
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

const PER_STOP_LOADING_MIN = 5;

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

function parseDurationToMinutes(duration: string): number {
  const parts = duration.split(" ");
  let mins = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "hr" || parts[i] === "hour") {
      mins += parseInt(parts[i - 1]) * 60;
    } else if (parts[i] === "min") {
      mins += parseInt(parts[i - 1]);
    }
  }
  return mins;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

function buildGoogleMapsUrl(stops: RouteStop[], fromRestaurant = false): string {
  if (fromRestaurant) {
    const parts = stops.map((s) => encodeURIComponent(s.address));
    return `https://www.google.com/maps/dir/${parts.join("/")}`;
  }
  const deliveryStops = stops.slice(1);
  if (deliveryStops.length === 0) return "";
  const parts = deliveryStops.map((s) => encodeURIComponent(s.address));
  return `https://www.google.com/maps/dir//${parts.join("/")}`;
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
  const [quantity, setQuantity] = useState("");
  const [restaurantLatLng, setRestaurantLatLng] = useState<LatLng | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

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

  async function geocodeRestaurant() {
    if (restaurantLatLng) return restaurantLatLng;
    setGeoLoading(true);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: restaurantAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Geocoding failed");
      const ll = { lat: data.lat, lng: data.lng };
      setRestaurantLatLng(ll);
      return ll;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geocoding failed");
      return null;
    } finally {
      setGeoLoading(false);
    }
  }

  async function autoSelectByQuantity(n: number) {
    setError("");
    setRouteResult(null);

    // Get restaurant lat/lng (geocode if needed)
    let origin = restaurantLatLng;
    if (!origin) {
      origin = await geocodeRestaurant();
      if (!origin) return;
    }

    // Filter orders that have lat/lng data
    const ordersWithCoords = acceptedOrders.filter(
      (o) => o.lat != null && o.lng != null
    );
    const withoutCoords = acceptedOrders.filter(
      (o) => o.lat == null || o.lng == null
    );

    if (ordersWithCoords.length === 0) {
      setError(t("route.selectAtLeastOne"));
      return;
    }

    // Sort by haversine distance from restaurant
    const sorted = [...ordersWithCoords].sort((a, b) => {
      const distA = haversineDistance(origin!, { lat: a.lat!, lng: a.lng! });
      const distB = haversineDistance(origin!, { lat: b.lat!, lng: b.lng! });
      return distA - distB;
    });

    // Take top N
    const count = Math.min(n, sorted.length);
    const selected = sorted.slice(0, count);

    // Also include orders without coords (by distance from restaurant if we've geocoded)
    const newSelected = new Set(selected.map((o) => o.id));
    if (withoutCoords.length > 0 && count < n) {
      // We can't sort without coords so just add them up to fill the quantity
      for (const o of withoutCoords) {
        if (newSelected.size >= n) break;
        newSelected.add(o.id);
      }
    }

    setSelectedIds(newSelected);
    setQuantity(String(count));
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

  // --- Compute adjusted duration ---
  let adjustedDuration: string | null = null;
  let adjustedDetail: string | null = null;
  if (routeResult) {
    const drivingMins = parseDurationToMinutes(routeResult.totalDuration);
    const deliveryStops = routeResult.stops.length - 1; // exclude restaurant (stop 0)
    const totalMins = drivingMins + deliveryStops * PER_STOP_LOADING_MIN;
    adjustedDuration = formatMinutes(totalMins);
    adjustedDetail = `${formatMinutes(drivingMins)} driving + ${deliveryStops} stops × ${PER_STOP_LOADING_MIN} min`;
  }

  const gmapsUrlCurrent = routeResult
    ? buildGoogleMapsUrl(routeResult.stops, false)
    : null;
  const gmapsUrlRestaurant = routeResult
    ? buildGoogleMapsUrl(routeResult.stops, true)
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

      {/* Feature 1: Quantity-based auto-select */}
      <div className="mt-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-stone-700">
          {t("route.autoSelect")}
        </h3>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={acceptedOrders.length}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => {
              const n = parseInt(quantity);
              if (n > 0 && n <= acceptedOrders.length) {
                autoSelectByQuantity(n);
              }
            }}
            placeholder="0"
            className="h-10 w-24 rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-amber-700"
          />
          <span className="text-sm text-stone-500">
            {t("route.enterQuantity")}
          </span>
          <button
            type="button"
            onClick={() => {
              const n = parseInt(quantity);
              if (n > 0 && n <= acceptedOrders.length) {
                autoSelectByQuantity(n);
              }
            }}
            disabled={geoLoading || !quantity || parseInt(quantity) <= 0}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {geoLoading ? "…" : t("route.autoSelectBtn")}
          </button>
        </div>
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
            {/* Feature 2: Raw driving time */}
            <div className="flex items-center gap-2">
              <span className="text-lg">🚗</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t("route.estimatedTimeRaw")}
                </p>
                <p className="text-lg font-bold text-emerald-900">
                  {routeResult.totalDuration}
                </p>
              </div>
            </div>
            {/* Feature 2: Adjusted duration (with stops) */}
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t("route.estimatedTimeAdjusted")}
                </p>
                <p className="text-lg font-bold text-emerald-900">
                  {adjustedDuration}
                </p>
                {adjustedDetail && (
                  <p className="mt-1 text-xs text-emerald-600">
                    {adjustedDetail}
                  </p>
                )}
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

          {/* Open in Google Maps buttons */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {gmapsUrlCurrent && (
              <a
                href={gmapsUrlCurrent}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                {t("route.navFromHere")}
              </a>
            )}
            {gmapsUrlRestaurant && (
              <a
                href={gmapsUrlRestaurant}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-stone-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-stone-600"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                {t("route.navFromRestaurant")}
              </a>
            )}
          </div>

          {/* Route order list */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-stone-700">
              {t("route.routeOrder")}
            </h3>
            <div className="mt-3 space-y-3">
              {routeResult.stops.map((stop, i) => {
                const orderMatch = acceptedOrders.find((o) =>
                  stop.label.startsWith(`#${o.id}`)
                );
                return (
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
                            : `${t("route.deliverTo")} #${orderMatch?.id || stop.index}`}
                        </p>
                        <p className="mt-0.5 text-sm text-stone-600">
                          {stop.label}
                        </p>

                        {/* Customer info + items for delivery stops */}
                        {i > 0 && orderMatch && (
                          <div className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-xs text-stone-600">
                            <p>
                              <span className="font-semibold text-stone-700">
                                {t("menu.contact")}:
                              </span>{" "}
                              {orderMatch.contact}
                            </p>
                            <p className="truncate">
                              <span className="font-semibold text-stone-700">
                                {t("menu.address")}:
                              </span>{" "}
                              {orderMatch.address}
                            </p>
                            <p>
                              <span className="font-semibold text-stone-700">
                                {t("order.items")}:
                              </span>{" "}
                              {orderMatch.items
                                .map((item) => `${item.quantity}x ${item.name}`)
                                .join(", ")}
                            </p>
                            {orderMatch.notes && (
                              <p>
                                <span className="font-semibold text-stone-700">
                                  {t("menu.notes")}:
                                </span>{" "}
                                {orderMatch.notes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Distance info */}
                        {i > 0 && (
                          <p className="mt-1 text-xs text-stone-400">
                            {routeResult.orderSummary[i]}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons for delivery stops */}
                    {i > 0 && orderMatch && orderMatch.status === "accepted" && (
                      <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            updateOrderStatus(orderMatch.id, "delivered");
                            calculateRoute();
                          }}
                          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          {t("route.markDelivered")} ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateOrderStatus(orderMatch.id, "cancelled");
                            calculateRoute();
                          }}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          {t("route.markException")} ✗
                        </button>
                      </div>
                    )}

                    {/* Show delivered/exception status */}
                    {i > 0 && orderMatch && orderMatch.status !== "accepted" && (
                      <div className="mt-3 border-t border-stone-100 pt-3">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                            orderMatch.status === "delivered"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {t(`order.${orderMatch.status}`)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
