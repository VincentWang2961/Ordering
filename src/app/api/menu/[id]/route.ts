import { NextRequest, NextResponse } from "next/server";
import pool, { setAuditUser } from "@/lib/db";
import { mapMenuItem } from "../../admin-data";

const menuFields: Record<string, string> = {
  name: "name",
  nameZhCN: "name_zh_cn",
  nameZhTW: "name_zh_tw",
  description: "description",
  descriptionZhCN: "description_zh_cn",
  descriptionZhTW: "description_zh_tw",
  price: "price",
  image: "image",
  category: "category",
  published: "published",
  availableDays: "available_days",
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = request.headers.get("x-user-id");
    const values: unknown[] = [];
    const assignments: string[] = [];

    for (const [key, column] of Object.entries(menuFields)) {
      if (!(key in body)) continue;
      values.push(body[key]);
      assignments.push(`${column} = $${values.length}`);
    }

    if ("availableDateRange" in body) {
      const range = body.availableDateRange as { start?: string; end?: string } | null;
      values.push(range?.start || null);
      assignments.push(`available_start_date = $${values.length}`);
      values.push(range?.end || null);
      assignments.push(`available_end_date = $${values.length}`);
    }

    if (assignments.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await client.query("BEGIN");
    if (userId) await setAuditUser(userId, client);

    values.push(id);
    const result = await client.query(
      `UPDATE menu_items SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    await client.query("COMMIT");
    return NextResponse.json(mapMenuItem(result.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update menu item error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id");

    await client.query("BEGIN");
    if (userId) await setAuditUser(userId, client);

    const result = await client.query("DELETE FROM menu_items WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete menu item error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
