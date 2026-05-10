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
}

async function geocodeAddress(address: string): Promise<LatLng> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(`Geocoding failed for: ${address}`);
  }
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
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

function nearestNeighborTSP(
  points: LatLng[],
  distanceMatrix: number[][]
): number[] {
  const n = points.length;
  const visited = new Set<number>();
  // Start at the restaurant (index 0)
  const route = [0];
  visited.add(0);

  let current = 0;
  while (visited.size < n) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < nearestDist) {
        nearestDist = distanceMatrix[current][i];
        nearest = i;
      }
    }
    if (nearest === -1) break;
    route.push(nearest);
    visited.add(nearest);
    current = nearest;
  }

  return route;
}

export async function POST(request: NextRequest) {
  try {
    const { restaurantAddress, orderAddresses, orderLabels } = await request.json();

    if (!restaurantAddress || !orderAddresses?.length) {
      return NextResponse.json(
        { error: "restaurantAddress and orderAddresses are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const isMock = !apiKey || apiKey === "YOUR_API_KEY_HERE";

    // Geocode all addresses
    const allAddresses = [restaurantAddress, ...orderAddresses];
    const allLabels = ["Restaurant / " + restaurantAddress, ...(orderLabels || orderAddresses)];

    let points: LatLng[];

    if (isMock) {
      // Mock coordinates around Perth for demo
      const baseLat = -31.9505;
      const baseLng = 115.8605;
      points = allAddresses.map((_, i) => ({
        lat: baseLat + (Math.random() - 0.5) * 0.08,
        lng: baseLng + (Math.random() - 0.5) * 0.08,
      }));
    } else {
      points = await Promise.all(allAddresses.map((addr: string) => geocodeAddress(addr)));
    }

    // Build distance matrix
    const distanceMatrix: number[][] = points.map((a) =>
      points.map((b) => haversineDistance(a, b))
    );

    // Nearest-neighbor TSP
    const routeIndices = nearestNeighborTSP(points, distanceMatrix);

    // Calculate totals
    let totalDistKm = 0;
    for (let i = 0; i < routeIndices.length - 1; i++) {
      totalDistKm += distanceMatrix[routeIndices[i]][routeIndices[i + 1]];
    }

    const totalDistStr =
      totalDistKm < 1
        ? `${Math.round(totalDistKm * 1000)} m`
        : `${totalDistKm.toFixed(1)} km`;

    const avgSpeedKmh = 30; // urban average
    const totalHours = totalDistKm / avgSpeedKmh;
    const totalMins = Math.round(totalHours * 60);
    const totalDurationStr =
      totalMins < 60
        ? `${totalMins} min`
        : `${Math.floor(totalMins / 60)} hr ${totalMins % 60} min`;

    // Build stop list
    const stops: Stop[] = routeIndices.map((idx, order) => ({
      index: order,
      address: allAddresses[idx],
      lat: points[idx].lat,
      lng: points[idx].lng,
      label: allLabels[idx],
    }));

    const orderSummary = stops.map((s, i) => {
      if (i === 0) return `Start: ${s.label}`;
      const prev = stops[i - 1];
      const segDist = distanceMatrix[routeIndices[i - 1]][routeIndices[i]];
      const segStr = segDist < 1 ? `${Math.round(segDist * 1000)} m` : `${segDist.toFixed(1)} km`;
      return `Stop ${s.index}: ${s.label} (${segStr} from previous)`;
    });

    return NextResponse.json({
      stops,
      totalDistance: totalDistStr,
      totalDuration: totalDurationStr,
      orderSummary,
      _mock: isMock,
    } satisfies RouteResult & { _mock: boolean });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
