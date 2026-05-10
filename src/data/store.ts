import { MenuItem, Order, RestaurantSettings } from "./types";
import { sampleMenu, defaultSettings } from "./sampleData";

const ORDERS_KEY = "ordering_orders";
const MENU_KEY = "ordering_menu";
const SETTINGS_KEY = "ordering_settings";

function generateOrderId(): string {
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

function loadOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function getOrders(): Order[] {
  return loadOrders();
}

export function getOrder(id: string): Order | undefined {
  return loadOrders().find((o) => o.id === id);
}

export function createOrder(params: {
  items: { menuId: string; name: string; quantity: number; price: number }[];
  total: number;
  pickupTime: string;
  address: string;
  lat?: number;
  lng?: number;
  contact: string;
  notes: string;
}): Order {
  const order: Order = {
    id: generateOrderId(),
    ...params,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

export function updateOrderStatus(
  id: string,
  status: "accepted" | "cancelled" | "delivered",
  photoBase64?: string
): Order | null {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx].status = status;
  if (status === "delivered") {
    orders[idx].deliveredAt = new Date().toISOString();
    if (photoBase64) orders[idx].deliveredPhoto = photoBase64;
  }
  saveOrders(orders);
  return orders[idx];
}

export function loadMenu(): MenuItem[] {
  if (typeof window === "undefined") return sampleMenu;
  try {
    const raw = localStorage.getItem(MENU_KEY);
    return raw ? JSON.parse(raw) : sampleMenu;
  } catch {
    return sampleMenu;
  }
}

export function saveMenu(items: MenuItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
}

export function loadSettings(): RestaurantSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: RestaurantSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function updateOrderFields(
  id: string,
  fields: Partial<Pick<Order, "address" | "contact" | "notes" | "pickupTime">>
): Order | null {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...fields };
  saveOrders(orders);
  return orders[idx];
}
