import type { QueryResultRow } from "pg";
import type { MenuItem, Order, OrderItem, RestaurantSettings } from "@/data/types";

export const settingsKeyToDbKey: Record<keyof RestaurantSettings, string> = {
  name: "name",
  nameZhCN: "name_zh_cn",
  nameZhTW: "name_zh_tw",
  pickupAddress: "pickup_address",
  pickupAddressZhCN: "pickup_address_zh_cn",
  pickupAddressZhTW: "pickup_address_zh_tw",
  contact: "contact",
};

export const dbKeyToSettingsKey = Object.fromEntries(
  Object.entries(settingsKeyToDbKey).map(([key, dbKey]) => [dbKey, key])
) as Record<string, keyof RestaurantSettings>;

function iso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export function mapOrderItem(row: QueryResultRow): OrderItem {
  return {
    menuId: row.menu_id,
    name: row.name,
    quantity: Number(row.quantity),
    price: Number(row.price),
  };
}

export function mapOrder(row: QueryResultRow, items: OrderItem[] = []): Order {
  return {
    id: row.id,
    items,
    total: Number(row.total),
    pickupTime: row.pickup_time,
    address: row.address,
    lat: row.lat == null ? undefined : Number(row.lat),
    lng: row.lng == null ? undefined : Number(row.lng),
    contact: row.contact,
    notes: row.notes,
    status: row.status,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    deliveredAt: iso(row.delivered_at),
    deliveredPhoto: row.delivered_photo ?? undefined,
    paid: Boolean(row.paid),
    paidAt: iso(row.paid_at),
    deliveryComment: row.delivery_comment ?? undefined,
  };
}

export function mapMenuItem(row: QueryResultRow): MenuItem {
  const start = row.available_start_date
    ? new Date(row.available_start_date).toISOString().slice(0, 10)
    : "";
  const end = row.available_end_date
    ? new Date(row.available_end_date).toISOString().slice(0, 10)
    : "";

  return {
    id: row.id,
    name: row.name,
    nameZhCN: row.name_zh_cn,
    nameZhTW: row.name_zh_tw,
    description: row.description,
    descriptionZhCN: row.description_zh_cn,
    descriptionZhTW: row.description_zh_tw,
    price: Number(row.price),
    image: row.image,
    category: row.category,
    published: Boolean(row.published),
    availableDateRange: start || end ? { start, end } : undefined,
    availableDays: row.available_days?.length ? row.available_days : undefined,
  };
}

export function generateOrderId(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return `${dd}${mm}${yyyy}-${code}`;
}
