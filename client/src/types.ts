export type Role = string;

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  price: number;
  description: string | null;
  image_path: string | null;
  active: number;
  sort_order: number;
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  items: MenuItem[];
}

export interface RestaurantTable {
  id: number;
  label: string;
  seats: number;
  status: "free" | "occupied";
  open_order_id: number | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number | null;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
  notes: string | null;
  kitchen_status: "pending" | "sent";
}

export interface Order {
  id: number;
  table_id: number | null;
  order_type: "dine_in" | "takeaway";
  status: "open" | "paid" | "void";
  created_by: number;
  created_at: string;
  closed_at: string | null;
  subtotal: number;
  total: number;
  payment_method: string | null;
  received_by: number | null;
  served_by_name: string | null;
  created_by_name: string | null;
  items: OrderItem[];
  table: RestaurantTable | null;
}

export interface AppUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  active: number;
  created_at: string;
}
