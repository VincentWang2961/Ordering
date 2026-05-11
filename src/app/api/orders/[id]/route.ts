import { NextRequest, NextResponse } from "next/server";
import pool, { setAuditUser } from "@/lib/db";
import { mapOrder, mapOrderItem } from "../../admin-data";

const orderFields: Record<string, string> = {
  contact: "contact",
  address: "address",
  lat: "lat",
  lng: "lng",
  pickupTime: "pickup_time",
  notes: "notes",
  status: "status",
  deliveredPhoto: "delivered_photo",
  photo: "delivered_photo",
  deliveryComment: "delivery_comment",
  total: "total",
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

    for (const [key, column] of Object.entries(orderFields)) {
      if (!(key in body)) continue;
      values.push(body[key]);
      assignments.push(`${column} = $${values.length}`);
    }

    if ("paid" in body) {
      values.push(Boolean(body.paid));
      assignments.push(`paid = $${values.length}`);
      assignments.push(body.paid ? "paid_at = COALESCE(paid_at, NOW())" : "paid_at = NULL");
    }

    if ("photoBase64" in body) {
      values.push(body.photoBase64);
      assignments.push(`delivered_photo = $${values.length}`);
    }

    if ("status" in body && body.status === "delivered" && !("deliveredAt" in body)) {
      assignments.push("delivered_at = COALESCE(delivered_at, NOW())");
    }

    await client.query("BEGIN");
    if (userId) await setAuditUser(userId, client);

    if (assignments.length > 0) {
      values.push(id);
      const updateResult = await client.query(
        `UPDATE orders SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values
      );

      if (updateResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    }

    const orderResult = await client.query("SELECT * FROM orders WHERE id = $1", [id]);
    const itemsResult = await client.query(
      "SELECT * FROM order_items WHERE order_id = $1",
      [id]
    );
    await client.query("COMMIT");

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(mapOrder(orderResult.rows[0], itemsResult.rows.map(mapOrderItem)));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update order error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
