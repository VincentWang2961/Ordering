"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";

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

export default function RouteMap({ stops, apiKey, locale, t }: RouteMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: ["routes"],
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const directionsService = useRef<google.maps.DirectionsService | null>(null);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    const bounds = new window.google.maps.LatLngBounds();
    stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
    mapInstance.fitBounds(bounds, 50);
    setMap(mapInstance);

    // Initialize directions service + renderer
    directionsService.current = new window.google.maps.DirectionsService();

    const renderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true, // We draw our own markers
      polylineOptions: {
        strokeColor: "#ea580c",
        strokeOpacity: 0.85,
        strokeWeight: 5,
      },
    });
    renderer.setMap(mapInstance);
    directionsRef.current = renderer;

    // Request actual road directions between consecutive stops
    if (stops.length >= 2) {
      const waypoints = stops.slice(1, -1).map((s) => ({
        location: new window.google.maps.LatLng(s.lat, s.lng),
        stopover: true,
      }));

      directionsService.current.route(
        {
          origin: new window.google.maps.LatLng(stops[0].lat, stops[0].lng),
          destination: new window.google.maps.LatLng(
            stops[stops.length - 1].lat,
            stops[stops.length - 1].lng
          ),
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (result, status) => {
          if (status === "OK" && result) {
            renderer.setDirections(result);
          }
          // If directions fail, the straight polyline fallback is handled in the next effect
        }
      );
    }
  }, [stops]);

  // Fit bounds when stops change
  useEffect(() => {
    if (map && stops.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      map.fitBounds(bounds, 50);

      // Re-request directions when stops change
      if (stops.length >= 2 && directionsService.current && directionsRef.current) {
        const waypoints = stops.slice(1, -1).map((s) => ({
          location: new window.google.maps.LatLng(s.lat, s.lng),
          stopover: true,
        }));

        directionsService.current.route(
          {
            origin: new window.google.maps.LatLng(stops[0].lat, stops[0].lng),
            destination: new window.google.maps.LatLng(
              stops[stops.length - 1].lat,
              stops[stops.length - 1].lng
            ),
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false,
          },
          (result, status) => {
            if (status === "OK" && result && directionsRef.current) {
              directionsRef.current.setDirections(result);
            }
          }
        );
      }
    }
  }, [map, stops]);

  // Cleanup GPS watch and directions renderer on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (directionsRef.current) {
        directionsRef.current.setMap(null);
      }
    };
  }, []);

  function toggleTracking() {
    setGpsError(null);

    if (tracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTracking(false);
      setCurrentPos(null);
      return;
    }

    // Try GPS — let the browser handle security context
    // (modern browsers allow GPS on localhost and some HTTP origins)
    if (!navigator.geolocation) {
      setGpsError(t("route.gpsUnsupported"));
      return;
    }

    const isSecure = window.location.protocol === "https:" || 
                     window.location.hostname === "localhost" || 
                     window.location.hostname === "127.0.0.1";

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsError(null);
      },
      (err) => {
        const messages: Record<number, string> = {
          [err.PERMISSION_DENIED]: isSecure
            ? t("route.gpsPermissionDenied")
            : t("route.gpsRequiresHttps"),
          [err.POSITION_UNAVAILABLE]: t("route.gpsUnavailable"),
          [err.TIMEOUT]: t("route.gpsTimeout"),
        };
        setGpsError(messages[err.code] || t("route.gpsError"));
        setTracking(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
    watchIdRef.current = watchId;
    setTracking(true);
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl bg-stone-100 text-sm text-stone-500">
        {t("route.loadingMap")}…
      </div>
    );
  }

  // Fallback polyline path (used only if Directions API fails)
  const fallbackPath = stops.map((s) => ({ lat: s.lat, lng: s.lng }));

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
        }}
      >
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
            }}
            label={{ text: "S", color: "#ffffff", fontSize: "12px", fontWeight: "bold" }}
            onClick={function(){ setSelectedMarker(0) }}
          />
        )}

        {stops.slice(1).map(function(stop, i) {
          return (
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
              }}
              label={{
                text: String(i + 1),
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "bold",
              }}
              onClick={function(){ setSelectedMarker(i + 1) }}
            />
          );
        })}

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
      <div className="mt-3">
        <div className="flex items-center justify-between">
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
        {gpsError && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {gpsError}
          </p>
        )}
      </div>
    </div>
  );
}
