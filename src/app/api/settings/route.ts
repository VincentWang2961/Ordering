import { NextRequest, NextResponse } from "next/server";
import pool, { setAuditUser } from "@/lib/db";
import type { RestaurantSettings } from "@/data/types";
import { dbKeyToSettingsKey, settingsKeyToDbKey } from "../admin-data";

const emptySettings: RestaurantSettings = {
  name: "",
  nameZhCN: "",
  nameZhTW: "",
  pickupAddress: "",
  pickupAddressZhCN: "",
  pickupAddressZhTW: "",
  contact: "",
};

export async function GET() {
  try {
    const result = await pool.query("SELECT key, value FROM restaurant_settings");
    const settings = { ...emptySettings };

    for (const row of result.rows) {
      const key = dbKeyToSettingsKey[row.key];
      if (key) settings[key] = row.value;
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error("Load settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const userId = request.headers.get("x-user-id");

    await client.query("BEGIN");
    if (userId) await setAuditUser(userId, client);

    for (const [key, value] of Object.entries(body)) {
      const dbKey = settingsKeyToDbKey[key as keyof RestaurantSettings];
      if (!dbKey) continue;
      await client.query(
        `INSERT INTO restaurant_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [dbKey, String(value ?? "")]
      );
    }

    const result = await client.query("SELECT key, value FROM restaurant_settings");
    await client.query("COMMIT");

    const settings = { ...emptySettings };
    for (const row of result.rows) {
      const key = dbKeyToSettingsKey[row.key];
      if (key) settings[key] = row.value;
    }

    return NextResponse.json(settings);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Save settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
