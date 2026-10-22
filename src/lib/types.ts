import type { Zone } from "./zones";
export type DeliverySlot = {
  id: string;
  label: string;
  start: string; // "18:00"
  end: string; // "20:00"
  capacity: number; // max orders in this window
};

export type Costs = {
  farm: number;
  inbound: number;
  packaging: number;
  payment: number;
  delivery: number;
};

/** The owner-editable store settings, as the app uses them. */
/** "auto" opens and closes by the clock; "open" and "closed" are the admin's manual override. */
export type StoreMode = "auto" | "open" | "closed";

export type StoreSettings = {
  storeName: string;
  areaName: string;
  supportPhone: string;
  price: number;
  priceUpdatedAt: Date | null;
  scheduled: { date: string; price: number } | null;
  costs: Costs;
  targetContribution: number;
  stock: number;
  /** Store opens for orders at this time (HH:MM, IST); it closes at `cutoff`. */
  openTime: string;
  storeMode: StoreMode;
  outOfStock: boolean;
  cutoff: string;
  deadline: string;
  daysAhead: number;
  slots: DeliverySlot[];
  deliveryFee: number;
  freeDeliveryFrom: number;
  maxTrays: number;
  pincodes: string[];
  codEnabled: boolean;
  /** Accept online payment (Razorpay). */
  onlineEnabled: boolean;
};

export const ORDER_FLOW = ["placed", "confirmed", "packed", "out", "delivered"] as const;
export type FlowStatus = (typeof ORDER_FLOW)[number];
export type OrderStatus = FlowStatus | "cancelled";
export const ACTIVE_STATUSES: OrderStatus[] = ["placed", "confirmed", "packed", "out"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type StatusTone = "yolk" | "info" | "warn" | "good" | "bad";
export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  placed: "yolk",
  confirmed: "info",
  packed: "info",
  out: "warn",
  delivered: "good",
  cancelled: "bad",
};

/** "online" is Razorpay (UPI, cards, netbanking); "upi" is the old UPI-on-delivery, kept for past orders. */
export type PaymentMethod = "cod" | "online" | "upi";
export type PaymentStatus = "pending" | "paid" | "refunded";

export type HistoryEntry = { status: OrderStatus; at: string; by: string };

/** An order as the UI sees it (JSON columns already parsed). */
export type OrderView = {
  id: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  slotId: string;
  slotLabel: string;
  trays: number;
  unitPrice: number;
  deliveryFee: number;
  total: number;
  productCost: number;
  deliveryCost: number;
  customer: { name: string; phone: string; address: string; landmark: string; pincode: string; lat: number | null; lng: number | null };
  notes: string;
  payment: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  history: HistoryEntry[];
  issue: { text: string; at: string; resolved: boolean } | null;
};

export type SlotAvailability = DeliverySlot & { left: number; ok: boolean; reason: "" | "full" | "closed" };

export type DayAvailability = {
  date: string;
  label: string; // Today / Tomorrow / Thu
  long: string; // Thu, 23 Oct
  slots: SlotAvailability[];
  open: boolean;
};

/** Why the store is or isn't taking orders. */
export type ShopReason = "open" | "closed" | "before_hours" | "after_hours" | "out_of_stock" | "sold_out";

export type ShopStatus = {
  open: boolean;
  sameDay: boolean;
  reason: ShopReason;
  tone: "good" | "warn" | "bad";
  text: string;
  detail: string;
  /** The hanging sign shown on order buttons while closed, or null when open. */
  board: { title: string; sub: string } | null;
};

/** Everything the order form needs, computed server-side at request time. */
export type Availability = {
  today: string;
  price: number;
  priceSince: string | null;
  available: number;
  maxTrays: number;
  status: ShopStatus;
  days: DayAvailability[];
  deliveryFee: number;
  freeDeliveryFrom: number;
  pincodes: string[];
  areaName: string;
  cutoff: string;
  deadline: string;
  /** Active delivery areas (empty when the PIN-code list is used instead). */
  zones: Zone[];
  /** Payment options open right now. `online` also needs Razorpay keys on the server. */
  payments: { cod: boolean; online: boolean };
  storeName: string;
};
