"use client";

import { useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
} from "@react-google-maps/api";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerified: (lat: number | null, lng: number | null) => void;
  placeholder?: string;
  t: (key: string) => string;
}

const mapContainerStyle = {
  width: "100%",
  height: "180px",
};

export default function AddressInput({
  value,
  onChange,
  onVerified,
  placeholder,
  t,
}: AddressInputProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValidRef = useRef<string>("");

  const showMap = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // Geocode the address with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setStatus("idle");
      setCoords(null);
      onVerified(null);
      return;
    }

    // Skip re-validation if address hasn't changed since last valid lookup
    if (trimmed === lastValidRef.current && coords) {
      return;
    }

    setStatus("loading");

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmed }),
        });

        const data = await res.json();

        if (res.ok && data.lat && data.lng) {
          lastValidRef.current = trimmed;
          setCoords({ lat: data.lat, lng: data.lng });
          setStatus("valid");
          setErrorMsg("");
          onVerified(data.lat, data.lng);
        } else {
          setCoords(null);
          setStatus("invalid");
          setErrorMsg(data.error || t("address.notFound"));
          onVerified(null);
        }
      } catch {
        setCoords(null);
        setStatus("invalid");
        setErrorMsg(t("address.geoError"));
        onVerified(null);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 h-12 w-full rounded-xl border px-4 outline-none transition ${
          status === "invalid"
            ? "border-red-400 focus:border-red-500"
            : status === "valid"
              ? "border-emerald-400 focus:border-emerald-600"
              : "border-stone-200 focus:border-amber-600"
        }`}
      />

      {/* Status indicators */}
      <div className="mt-1.5 min-h-[20px]">
        {status === "loading" && (
          <p className="text-xs text-stone-400">{t("address.verifying")}…</p>
        )}
        {status === "valid" && (
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            {t("address.verified")}
          </p>
        )}
        {status === "invalid" && (
          <p className="text-xs font-medium text-red-500">{errorMsg}</p>
        )}
      </div>

      {/* Map preview when address is valid */}
      {status === "valid" && coords && showMap.isLoaded && (
        <div className="mt-2 overflow-hidden rounded-xl border border-stone-200">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={coords}
            zoom={15}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              zoomControl: true,
              disableDefaultUI: false,
              styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
            }}
          >
            <Marker
              position={coords}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#dc2626",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              }}
            />
          </GoogleMap>
        </div>
      )}
      {status === "valid" && !showMap.isLoaded && (
        <div className="mt-2 flex h-[120px] items-center justify-center rounded-xl bg-stone-100 text-xs text-stone-400">
          {t("address.loadingMap")}…
        </div>
      )}
    </div>
  );
}
