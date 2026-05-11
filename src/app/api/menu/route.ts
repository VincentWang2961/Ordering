import { NextRequest, NextResponse } from "next/server";
import pool, { setAuditUser } from "@/lib/db";
import { mapMenuItem } from "../admin-data";

function menuValues(body: Record<string, unknown>, id: string) {
  const range = body.availableDateRange as { start?: string; end?: string } | undefined;
  return [
    id,
    body.name ?? "",
    body.nameZhCN ?? "",
    body.nameZhTW ?? "",
    body.description ?? "",
    body.descriptionZhCN ?? "",
    body.descriptionZhTW ?? "",
    body.price ?? 0,
    body.image ?? "",
    body.category ?? "",
    body.published ?? true,
    range?.start || null,
    range?.end || null,
    body.availableDays ?? [],
  ];
}

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT * FROM menu_items ORDER BY category ASC, name ASC"
    );
    return NextResponse.json(result.rows.map(mapMenuItem));
  } catch (err) {
    console.error("List menu error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const userId = request.headers.get("x-user-id");
    const id = body.id || `item-${Date.now()}`;

    await client.query("BEGIN");
    if (userId) await setAuditUser(userId, client);

    const result = await client.query(
      `INSERT INTO menu_items (
        id, name, name_zh_cn, name_zh_tw, description, description_zh_cn,
        description_zh_tw, price, image, category, published,
        available_start_date, available_end_date, available_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        name_zh_cn = EXCLUDED.name_zh_cn,
        name_zh_tw = EXCLUDED.name_zh_tw,
        description = EXCLUDED.description,
        description_zh_cn = EXCLUDED.description_zh_cn,
        description_zh_tw = EXCLUDED.description_zh_tw,
        price = EXCLUDED.price,
        image = EXCLUDED.image,
        category = EXCLUDED.category,
        published = EXCLUDED.published,
        available_start_date = EXCLUDED.available_start_date,
        available_end_date = EXCLUDED.available_end_date,
        available_days = EXCLUDED.available_days
      RETURNING *`,
      menuValues(body, id)
    );

    await client.query("COMMIT");
    return NextResponse.json(mapMenuItem(result.rows[0]), { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create menu item error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
