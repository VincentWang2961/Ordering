"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import type { Order } from "../../../data/types";

interface OrderMapProps {
  orders: Order[];
  selectedIds: Set<string>;
  restaurantAddress: string;
  restaurantLatLng: { lat: number; lng: number } | null;
  onToggleOrder: (id: string) => void;
  apiKey: string;
  t: (key: string) => string;
}

const containerStyle = {
  width: "100%",
  height: "420px",
};

const fallbackCenter = { lat: -31.9505, lng: 115.8605 };

export default function OrderMap({
  orders,
  selectedIds,
  restaurantAddress,
  restaurantLatLng,
  onToggleOrder,
  apiKey,
  t,
}: OrderMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showRestaurantInfo, setShowRestaurantInfo] = useState(false);

  const ordersWithCoords = useMemo(
    () => orders.filter((order) => order.lat != null && order.lng != null),
    [orders]
  );
  const ordersWithoutCoords = useMemo(
    () => orders.filter((order) => order.lat == null || order.lng == null),
    [orders]
  );

  const markerPoints = useMemo(() => {
    const points = ordersWithCoords.map((order) => ({
      lat: order.lat!,
      lng: order.lng!,
    }));
    if (restaurantLatLng) points.unshift(restaurantLatLng);
    return points;
  }, [ordersWithCoords, restaurantLatLng]);

  const center = restaurantLatLng || markerPoints[0] || fallbackCenter;

  const fitMapBounds = useCallback(
    (targetMap: google.maps.Map) => {
      if (markerPoints.length === 0) return;

      const bounds = new window.google.maps.LatLngBounds();
      markerPoints.forEach((point) => bounds.extend(point));

      if (markerPoints.length === 1) {
        targetMap.setCenter(markerPoints[0]);
        targetMap.setZoom(14);
      } else {
        targetMap.fitBounds(bounds, 50);
      }
    },
    [markerPoints]
  );

  const onLoad = useCallback(
    (loadedMap: google.maps.Map) => {
      fitMapBounds(loadedMap);
      setMap(loadedMap);
    },
    [fitMapBounds]
  );

  useEffect(() => {
    if (map) fitMapBounds(map);
  }, [fitMapBounds, map]);

  const activeOrder = activeOrderId
    ? ordersWithCoords.find((order) => order.id === activeOrderId)
    : null;

  if (!apiKey) {
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-sm text-stone-600">
        Google Maps API key is missing.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl bg-stone-100 text-sm text-stone-500">
        {t("route.loadingMap")}...
      </div>
    );
  }

  return (
    <div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={13}
        onLoad={onLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        }}
      >
        {restaurantLatLng && (
          <Marker
            position={restaurantLatLng}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#16a34a",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              labelOrigin: new window.google.maps.Point(0, 0),
            }}
            label={{
              text: "S",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "bold",
            }}
            onClick={() => {
              setActiveOrderId(null);
              setShowRestaurantInfo(true);
            }}
          />
        )}

        {ordersWithCoords.map((order, index) => (
          <Marker
            key={order.id}
            position={{ lat: order.lat!, lng: order.lng! }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: selectedIds.has(order.id) ? "#d97706" : "#1c1917",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              labelOrigin: new window.google.maps.Point(0, 0),
            }}
            label={{
              text: String(index + 1),
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "bold",
            }}
            onClick={() => {
              onToggleOrder(order.id);
              setShowRestaurantInfo(false);
            }}
          />
        ))}

        {showRestaurantInfo && restaurantLatLng && (
          <InfoWindow
            position={restaurantLatLng}
            onCloseClick={() => setShowRestaurantInfo(false)}
          >
            <div className="max-w-[220px] text-sm">
              <p className="font-semibold text-stone-950">
                {t("route.startFrom")}
              </p>
              <p className="mt-1 text-stone-600">{restaurantAddress}</p>
            </div>
          </InfoWindow>
        )}

        {activeOrder && (
          <InfoWindow
            position={{ lat: activeOrder.lat!, lng: activeOrder.lng! }}
            onCloseClick={() => setActiveOrderId(null)}
          >
            <div className="max-w-[240px] text-sm">
              <p className="font-semibold text-stone-950">
                #{activeOrder.id} - {activeOrder.contact}
              </p>
              <p className="mt-1 text-stone-600">{activeOrder.address}</p>
              <p className="mt-1 text-xs text-stone-500">
                {activeOrder.items.length} item
                {activeOrder.items.length !== 1 ? "s" : ""} - $
                {activeOrder.total.toFixed(2)}
              </p>
              {activeOrder.notes && (
                <p className="mt-1 text-xs text-stone-500">
                  {activeOrder.notes}
                </p>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {ordersWithoutCoords.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-stone-600">
          {ordersWithoutCoords.length} accepted order
          {ordersWithoutCoords.length !== 1 ? "s" : ""} cannot be shown on the
          map because coordinates are missing.
        </p>
      )}
    </div>
  );
}
