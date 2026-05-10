"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";

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
  t: (key: string) => string;
}

const containerStyle = {
  width: "100%",
  height: "450px",
};

export default function RouteMap({ stops, apiKey, t }: RouteMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);

  const path = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const center = stops[0] || { lat: -31.9505, lng: 115.8605 };

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      const bounds = new window.google.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      map.fitBounds(bounds, 50);
      setMap(map);
    },
    [stops]
  );

  useEffect(() => {
    if (map && stops.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      map.fitBounds(bounds, 50);
    }
  }, [map, stops]);

  if (!isLoaded) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl bg-stone-100 text-sm text-stone-500">
        {t("route.loadingMap")}…
      </div>
    );
  }

  return (
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
      {/* Route polyline connecting stops in order */}
      <Polyline
        path={path}
        options={{
          strokeColor: "#ea580c",
          strokeOpacity: 0.8,
          strokeWeight: 4,
          geodesic: true,
        }}
      />

      {/* Start marker (restaurant) */}
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
          label={{
            text: "S",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: "bold",
          }}
          onClick={() => setSelectedMarker(0)}
        />
      )}

      {/* Stop markers (numbered 1, 2, 3...) */}
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

      {/* Info window on marker click */}
      {selectedMarker !== null && stops[selectedMarker] && (
        <InfoWindow
          position={{
            lat: stops[selectedMarker].lat,
            lng: stops[selectedMarker].lng,
          }}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div className="max-w-[220px] text-sm">
            <p className="font-semibold text-stone-950">
              {selectedMarker === 0
                ? t("route.startFrom")
                : `${t("route.stopNum")} ${selectedMarker}`}
            </p>
            <p className="mt-1 text-stone-600">
              {stops[selectedMarker].label}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              {stops[selectedMarker].address}
            </p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
