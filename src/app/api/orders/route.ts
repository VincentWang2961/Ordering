import { NextRequest, NextResponse } from "next/server";
import pool, { setAuditUser } from "@/lib/db";
import type { OrderItem } from "@/data/types";
import { generateOrderId, mapOrder, mapOrderItem } from "../admin-data";

export async function GET() {
  try {
    const ordersResult = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
    const orders = await Promise.all(
      ordersResult.rows.map(async (row) => {
        const itemsResult = await pool.query(
          "SELECT * FROM order_items WHERE order_id = $1",
          [row.id]
        );
        return mapOrder(row, itemsResult.rows.map(mapOrderItem));
      })
    );
    return NextResponse.json(orders);
  } catch (err) {
    console.error("List orders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const userId = request.headers.get("x-user-id");
    const items = (body.items ?? []) as OrderItem[];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one order item is required" }, { status: 400 });
    }

    const id = body.id || generateOrderId();
    const paid = Boolean(body.paid);
    const status = body.status ?? "pending";

    await client.query("BEGIN");
    if (userId) await setAuditUser(userId, client);

    const orderResult = await client.query(
      `INSERT INTO orders (
        id, contact, address, lat, lng, pickup_time, notes, status, total,
        paid, paid_at, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()))
      ON CONFLICT (id) DO NOTHING
      RETURNING *`,
      [
        id,
        body.contact ?? "",
        body.address ?? "",
        body.lat ?? null,
        body.lng ?? null,
        body.pickupTime ?? "",
        body.notes ?? "",
        status,
        body.total ?? 0,
        paid,
        paid ? new Date() : null,
        userId || null,
        body.createdAt ?? null,
      ]
    );

    if (orderResult.rows.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_id, name, quantity, price)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, item.menuId, item.name, item.quantity, item.price]
        );
      }
    }

    const finalOrderResult =
      orderResult.rows.length > 0
        ? orderResult
        : await client.query("SELECT * FROM orders WHERE id = $1", [id]);
    const itemsResult = await client.query(
      "SELECT * FROM order_items WHERE order_id = $1",
      [id]
    );
    await client.query("COMMIT");

    return NextResponse.json(
      mapOrder(finalOrderResult.rows[0], itemsResult.rows.map(mapOrderItem)),
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create order error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
