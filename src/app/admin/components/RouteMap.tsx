"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from "@react-google-maps/api";

interface RouteStop {
  index: number;
  address: string;
  lat: number;
  lng: number;
  label: string;
}

interface RouteMapProps {
  stops: RouteStop[];
  apiKey: string;
  locale: string;
  t: (key: string) => string;
}

const containerStyle = {
  width: "100%",
  height: "450px",
};

const STOP_LABELS = ["🏁", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

export default function RouteMap({ stops, apiKey, locale, t }: RouteMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;

  const path = stops.map((s) => ({ lat: s.lat, lng: s.lng }));

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new window.google.maps.LatLngBounds();
    stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
    map.fitBounds(bounds, 50);
    setMap(map);
  }, [stops]);

  // Fit bounds when stops change
  useEffect(() => {
    if (map && stops.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      map.fitBounds(bounds, 50);
    }
  }, [map, stops]);

  // Real-time GPS tracking
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function toggleTracking() {
    if (tracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTracking(false);
      setCurrentPos(null);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported on this device.");
        return;
      }
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentPos({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          alert("Failed to get location. Check device permissions.");
          setTracking(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      watchIdRef.current = watchId;
      setTracking(true);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl bg-stone-100 text-sm text-stone-500">
        {t("route.loadingMap")}…
      </div>
    );
  }

  return (
    <div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={stops[0] || { lat: -31.95, lng: 115.86 }}
        zoom={13}
        onLoad={onLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
          ],
        }}
      >
        {/* Route polyline */}
        <Polyline
          path={path}
          options={{
            strokeColor: "#ea580c",
            strokeOpacity: 0.8,
            strokeWeight: 4,
            geodesic: true,
          }}
        />

        {/* Start marker */}
        {stops.length > 0 && (
          <Marker
            position={{ lat: stops[0].lat, lng: stops[0].lng }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#16a34a",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              labelOrigin: new window.google.maps.Point(0, 0),
            }}
            label={{ text: "S", color: "#ffffff", fontSize: "12px", fontWeight: "bold" }}
            onClick={() => setSelectedMarker(0)}
          />
        )}

        {/* Order markers */}
        {stops.slice(1).map((stop, i) => (
          <Marker
            key={stop.index}
            position={{ lat: stop.lat, lng: stop.lng }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: "#1c1917",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              labelOrigin: new window.google.maps.Point(0, 0),
            }}
            label={{
              text: String(i + 1),
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "bold",
            }}
            onClick={() => setSelectedMarker(i + 1)}
          />
        ))}

        {/* Current location marker */}
        {currentPos && (
          <Marker
            position={currentPos}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            }}
            title="You are here"
          />
        )}

        {/* Info window */}
        {selectedMarker !== null && stops[selectedMarker] && (
          <InfoWindow
            position={{
              lat: stops[selectedMarker].lat,
              lng: stops[selectedMarker].lng,
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="max-w-[200px] text-sm">
              <p className="font-semibold text-stone-950">
                {selectedMarker === 0
                  ? t("route.startFrom")
                  : `${t("route.stopNum")} ${selectedMarker}`}
              </p>
              <p className="mt-1 text-stone-600">{stops[selectedMarker].label}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Tracking toggle */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={toggleTracking}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            tracking
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border border-stone-300 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <span className={tracking ? "animate-pulse" : ""}>
            {tracking ? "📍" : "📡"}
          </span>
          {tracking ? t("route.trackingActive") : t("route.enableTracking")}
        </button>
        {currentPos && (
          <span className="text-xs text-stone-500">
            {currentPos.lat.toFixed(4)}, {currentPos.lng.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
