export interface MenuItem {
  id: string;
  name: string;
  nameZhCN: string;
  nameZhTW: string;
  description: string;
  descriptionZhCN: string;
  descriptionZhTW: string;
  price: number;
  image: string;
  category: string;
  published: boolean;
  availableDateRange?: {
    start: string;
    end: string;
  };
  availableDays?: number[];
}

export interface OrderItem {
  menuId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  pickupTime: string;
  address: string;
  lat?: number;
  lng?: number;
  contact: string;
  notes: string;
  status: "pending" | "accepted" | "cancelled" | "delivered";
  createdAt: string;
  deliveredAt?: string;
  deliveredPhoto?: string;
  paid: boolean;
  paidAt?: string;
}

export interface RestaurantSettings {
  name: string;
  nameZhCN: string;
  nameZhTW: string;
  pickupAddress: string;
  pickupAddressZhCN: string;
  pickupAddressZhTW: string;
  contact: string;
}
