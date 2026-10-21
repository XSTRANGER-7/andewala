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
  salesPaused: boolean;
  cutoff: string;
  deadline: string;
  daysAhead: number;
  slots: DeliverySlot[];
  deliveryFee: number;
  freeDeliveryFrom: number;
  maxTrays: number;
  pincodes: string[];
  codEnabled: boolean;
  upiOnDelivery: boolean;
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

export type PaymentMethod = "cod" | "upi";

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
  paymentStatus: "pending" | "paid";
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

export type ShopStatus = {
  open: boolean;
  sameDay: boolean;
  tone: "good" | "warn" | "bad";
  text: string;
  detail: string;
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
  payments: { cod: boolean; upi: boolean };
  storeName: string;
};
