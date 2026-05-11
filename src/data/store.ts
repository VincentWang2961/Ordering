import { MenuItem, Order, RestaurantSettings } from "./types";
import { sampleMenu, defaultSettings } from "./sampleData";

const ORDERS_KEY = "ordering_orders";
const MENU_KEY = "ordering_menu";
const SETTINGS_KEY = "ordering_settings";
const MIGRATION_KEY = "ordering_db_migration_done";
const AUTH_KEY = "ordering_auth";

let ordersCache: Order[] = [];
let menuCache: MenuItem[] = sampleMenu;
let settingsCache: RestaurantSettings = defaultSettings;

function getAuditHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return {};
    const auth = JSON.parse(raw);
    return auth.user?.id ? { "X-User-Id": auth.user.id } : {};
  } catch {
    return {};
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuditHeaders(),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data as T;
}

export async function getOrdersAsync(): Promise<Order[]> {
  ordersCache = await apiJson<Order[]>("/api/orders");
  return ordersCache;
}

export function getOrders(): Order[] {
  return ordersCache;
}

export async function getOrderAsync(id: string): Promise<Order | undefined> {
  const orders = await getOrdersAsync();
  return orders.find((o) => o.id === id);
}

export function getOrder(id: string): Order | undefined {
  return ordersCache.find((o) => o.id === id);
}

export async function createOrder(params: {
  items: { menuId: string; name: string; quantity: number; price: number }[];
  total: number;
  pickupTime: string;
  address: string;
  lat?: number;
  lng?: number;
  contact: string;
  notes: string;
  paid?: boolean;
  status?: Order["status"];
  id?: string;
  createdAt?: string;
}): Promise<Order> {
  const order = await apiJson<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(params),
  });
  ordersCache = [order, ...ordersCache.filter((current) => current.id !== order.id)];
  return order;
}

export async function updateOrderStatus(
  id: string,
  status: "accepted" | "cancelled" | "delivered",
  photoBase64?: string,
  deliveryComment?: string
): Promise<Order | null> {
  const order = await apiJson<Order>(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status, photoBase64, deliveryComment }),
  });
  ordersCache = ordersCache.map((current) => (current.id === id ? order : current));
  return order;
}

export async function updateOrderPaymentStatus(
  id: string,
  paid: boolean
): Promise<Order | null> {
  const order = await apiJson<Order>(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ paid }),
  });
  ordersCache = ordersCache.map((current) => (current.id === id ? order : current));
  return order;
}

export async function updateOrderFields(
  id: string,
  fields: Partial<Pick<Order, "address" | "contact" | "notes" | "pickupTime" | "paid">>
): Promise<Order | null> {
  const order = await apiJson<Order>(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(fields),
  });
  ordersCache = ordersCache.map((current) => (current.id === id ? order : current));
  return order;
}

export async function loadMenuAsync(): Promise<MenuItem[]> {
  menuCache = await apiJson<MenuItem[]>("/api/menu");
  return menuCache;
}

export function loadMenu(): MenuItem[] {
  return menuCache;
}

export async function saveMenu(items: MenuItem[]): Promise<void> {
  const previousIds = new Set(menuCache.map((item) => item.id));
  const nextIds = new Set(items.map((item) => item.id));

  for (const item of items) {
    const path = previousIds.has(item.id)
      ? `/api/menu/${encodeURIComponent(item.id)}`
      : "/api/menu";
    await apiJson<MenuItem>(path, {
      method: previousIds.has(item.id) ? "PUT" : "POST",
      body: JSON.stringify(item),
    });
  }

  for (const oldItem of menuCache) {
    if (!nextIds.has(oldItem.id)) {
      await apiJson(`/api/menu/${encodeURIComponent(oldItem.id)}`, {
        method: "DELETE",
      });
    }
  }

  menuCache = await loadMenuAsync();
}

export async function loadSettingsAsync(): Promise<RestaurantSettings> {
  settingsCache = await apiJson<RestaurantSettings>("/api/settings");
  return settingsCache;
}

export function loadSettings(): RestaurantSettings {
  return settingsCache;
}

export async function saveSettings(settings: RestaurantSettings): Promise<void> {
  settingsCache = await apiJson<RestaurantSettings>("/api/settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export async function migrateLocalStorageToDB(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const rawOrders = localStorage.getItem(ORDERS_KEY);
  const rawMenu = localStorage.getItem(MENU_KEY);
  const rawSettings = localStorage.getItem(SETTINGS_KEY);

  const localOrders = rawOrders ? (JSON.parse(rawOrders) as Order[]) : [];
  const localMenu = rawMenu ? (JSON.parse(rawMenu) as MenuItem[]) : [];
  const localSettings = rawSettings ? (JSON.parse(rawSettings) as RestaurantSettings) : null;

  for (const order of localOrders) {
    await createOrder(order);
  }

  for (const item of localMenu) {
    await apiJson<MenuItem>("/api/menu", {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  if (localSettings) {
    await saveSettings(localSettings);
  }

  localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
}
