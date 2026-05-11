import { NextRequest, NextResponse } from "next/server";

interface LatLng {
  lat: number;
  lng: number;
}

interface Stop {
  index: number;
  address: string;
  lat: number;
  lng: number;
  label: string;
}

interface RouteResult {
  stops: Stop[];
  totalDistance: string;
  totalDuration: string;
  orderSummary: string[];
  totalDistanceKm: number;
  totalDurationSeconds: number;
  polyline?: string;
  _mock?: boolean;
}

interface OptimizeRouteRequest {
  restaurantAddress?: string;
  orderAddresses?: string[];
  orderLabels?: string[];
  endAddress?: string;
}

interface RoutesApiResponse {
  routes?: Array<{
    optimizedIntermediateWaypointIndex?: number[];
    duration?: string;
    distanceMeters?: number;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

async function geocodeAddress(address: string): Promise<LatLng> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(`Geocoding failed for: ${address}`);
  }
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

function hasRealGoogleMapsKey(apiKey: string | undefined): apiKey is string {
  return Boolean(
    apiKey &&
      apiKey !== "YOUR_API_KEY_HERE" &&
      apiKey !== "GOOGLE_MAPS_API_KEY" &&
      !apiKey.toLowerCase().includes("placeholder")
  );
}

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
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

function nearestNeighborWithOptionalEnd(
  points: LatLng[],
  distanceMatrix: number[][],
  endIndex?: number
): number[] {
  const n = points.length;
  const visited = new Set<number>();
  const route = [0];
  visited.add(0);

  let current = 0;
  while (visited.size < n) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited.has(i) || i === endIndex) continue;
      if (distanceMatrix[current][i] < nearestDist) {
        nearestDist = distanceMatrix[current][i];
        nearest = i;
      }
    }
    if (nearest === -1) break;
    route.push(nearest);
    visited.add(nearest);
    current = nearest;
  }

  if (endIndex != null && !visited.has(endIndex)) {
    route.push(endIndex);
  }

  return route;
}

function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDurationSeconds(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

function parseGoogleDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.round(Number(match[1])) : 0;
}

async function calculateGoogleRoute(
  apiKey: string,
  restaurantAddress: string,
  orderAddresses: string[],
  orderLabels: string[],
  endAddress?: string
): Promise<RouteResult> {
    const destinationAddress = endAddress || orderAddresses[orderAddresses.length - 1];
    // Filter out destination from intermediates to avoid duplicates
    const intermediates = orderAddresses
      .filter((addr) => addr !== destinationAddress)
      .map((address) => ({ address }));
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.optimizedIntermediateWaypointIndex,routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { address: restaurantAddress },
      destination: { address: destinationAddress },
      intermediates,
      travelMode: "DRIVE",
      optimizeWaypointOrder: true,
    }),
  });

  const data = (await res.json()) as RoutesApiResponse;
  if (!res.ok) {
    throw new Error(data.error?.message || "Google Routes API request failed");
  }

  const route = data.routes?.[0];
  if (!route) {
    throw new Error("Google Routes API returned no routes");
  }

  const optimizedIndices =
    route.optimizedIntermediateWaypointIndex?.length === orderAddresses.length
      ? route.optimizedIntermediateWaypointIndex
      : orderAddresses.map((_, index) => index);

  const orderedOrderAddresses = optimizedIndices.map((index) => orderAddresses[index]);
  const orderedOrderLabels = optimizedIndices.map(
    (index) => orderLabels[index] || orderAddresses[index]
  );
  const stopAddresses = endAddress
    ? [restaurantAddress, ...orderedOrderAddresses, endAddress]
    : [restaurantAddress, ...orderedOrderAddresses];
  const stopLabels = endAddress
    ? [
        `Restaurant / ${restaurantAddress}`,
        ...orderedOrderLabels,
        `End: ${endAddress}`,
      ]
    : [`Restaurant / ${restaurantAddress}`, ...orderedOrderLabels];

  const points = await Promise.all(stopAddresses.map((address) => geocodeAddress(address)));
  const stops = stopAddresses.map((address, index) => ({
    index,
    address,
    lat: points[index].lat,
    lng: points[index].lng,
    label: stopLabels[index],
  }));

  const totalDurationSeconds = parseGoogleDurationSeconds(route.duration);
  const totalDistanceMeters = route.distanceMeters ?? 0;
  const totalDistanceKm = totalDistanceMeters / 1000;

  return {
    stops,
    totalDistance: formatDistanceMeters(totalDistanceMeters),
    totalDuration: formatDurationSeconds(totalDurationSeconds),
    orderSummary: stops.map((stop, index) => {
      if (index === 0) return `Start: ${stop.label}`;
      if (endAddress && index === stops.length - 1) return `End: ${stop.address}`;
      return `Stop ${index}: ${stop.label}`;
    }),
    totalDistanceKm,
    totalDurationSeconds,
    polyline: route.polyline?.encodedPolyline,
  };
}

function calculateMockRoute(
  restaurantAddress: string,
  orderAddresses: string[],
  orderLabels: string[],
  endAddress?: string
): RouteResult {
  const allAddresses = endAddress
    ? [restaurantAddress, ...orderAddresses, endAddress]
    : [restaurantAddress, ...orderAddresses];
  const allLabels = endAddress
    ? [
        `Restaurant / ${restaurantAddress}`,
        ...orderAddresses.map((address, index) => orderLabels[index] || address),
        `End: ${endAddress}`,
      ]
    : [
        `Restaurant / ${restaurantAddress}`,
        ...orderAddresses.map((address, index) => orderLabels[index] || address),
      ];

  const baseLat = -31.9505;
  const baseLng = 115.8605;
  const points = allAddresses.map((_, i) => ({
    lat: baseLat + (Math.sin(i + 1) * 0.04),
    lng: baseLng + (Math.cos(i + 1) * 0.04),
  }));

  const distanceMatrix = points.map((a) =>
    points.map((b) => haversineDistance(a, b))
  );
  const routeIndices = nearestNeighborWithOptionalEnd(
    points,
    distanceMatrix,
    endAddress ? allAddresses.length - 1 : undefined
  );

  let totalDistanceKm = 0;
  for (let i = 0; i < routeIndices.length - 1; i++) {
    totalDistanceKm += distanceMatrix[routeIndices[i]][routeIndices[i + 1]];
  }

  const totalDurationSeconds = Math.round((totalDistanceKm / 30) * 60 * 60);
  const stops = routeIndices.map((idx, order) => ({
    index: order,
    address: allAddresses[idx],
    lat: points[idx].lat,
    lng: points[idx].lng,
    label: allLabels[idx],
  }));

  return {
    stops,
    totalDistance: formatDistanceMeters(totalDistanceKm * 1000),
    totalDuration: formatDurationSeconds(totalDurationSeconds),
    orderSummary: stops.map((stop, i) => {
      if (i === 0) return `Start: ${stop.label}`;
      const segDist = distanceMatrix[routeIndices[i - 1]][routeIndices[i]];
      const segStr = formatDistanceMeters(segDist * 1000);
      if (endAddress && i === stops.length - 1) {
        return `End: ${stop.address} (${segStr} from previous)`;
      }
      return `Stop ${i}: ${stop.label} (${segStr} from previous)`;
    }),
    totalDistanceKm,
    totalDurationSeconds,
    _mock: true,
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      restaurantAddress,
      orderAddresses,
      orderLabels = [],
      endAddress,
    } = (await request.json()) as OptimizeRouteRequest;

    if (!restaurantAddress || !orderAddresses?.length) {
      return NextResponse.json(
        { error: "restaurantAddress and orderAddresses are required" },
        { status: 400 }
      );
    }

    const normalizedEndAddress = endAddress?.trim() || undefined;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const result = hasRealGoogleMapsKey(apiKey)
      ? await calculateGoogleRoute(
          apiKey,
          restaurantAddress,
          orderAddresses,
          orderLabels,
          normalizedEndAddress
        )
      : calculateMockRoute(
          restaurantAddress,
          orderAddresses,
          orderLabels,
          normalizedEndAddress
        );

    return NextResponse.json(result satisfies RouteResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
