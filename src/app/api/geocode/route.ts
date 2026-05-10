import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { address } = await request.json();
  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    // Fallback: return mock coordinates for demo
    return NextResponse.json({
      lat: -31.9505 + Math.random() * 0.05,
      lng: 115.8605 + Math.random() * 0.05,
      _mock: true,
    });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.[0]) {
      return NextResponse.json({ error: "Geocoding failed", status: data.status }, { status: 400 });
    }

    const { lat, lng } = data.results[0].geometry.location;
    return NextResponse.json({ lat, lng });
  } catch (err) {
    return NextResponse.json({ error: "Geocoding request failed" }, { status: 500 });
  }
}
