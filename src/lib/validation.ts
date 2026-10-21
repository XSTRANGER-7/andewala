import { z } from "zod";

const latSchema = z.number().finite().min(-90).max(90);
const lngSchema = z.number().finite().min(-180).max(180);

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, "").slice(-10))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a 10-digit Indian mobile number.");

export const pincodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit PIN code.");

export const placeOrderSchema = z.object({
  trays: z.number().int().min(1, "Order at least one tray.").max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a delivery day."),
  slotId: z.string().min(1, "Pick a delivery window."),
  payment: z.enum(["cod", "online"]),
  name: z.string().trim().min(2, "Enter your name.").max(80),
  phone: phoneSchema,
  address: z.string().trim().min(8, "Add your house number, street and area.").max(300),
  landmark: z.string().trim().max(120).default(""),
  pincode: pincodeSchema,
  lat: latSchema.nullable().default(null),
  lng: lngSchema.nullable().default(null),
  notes: z.string().trim().max(200).default(""),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export const findOrderSchema = z.object({
  id: z.string().trim().toUpperCase().min(6),
  phone: phoneSchema,
});

const optionalPhone = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(/\D/g, "").slice(-10) : undefined));

export const issueSchema = z.object({
  orderId: z.string().min(1),
  text: z.string().trim().min(3, "Tell us what went wrong.").max(500),
  phone: optionalPhone,
});

export const cancelSchema = z.object({ id: z.string().min(1), phone: optionalPhone });

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export const slotSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(40),
  start: timeString,
  end: timeString,
  capacity: z.number().int().min(0).max(500),
});

export const settingsSchema = z
  .object({
    storeName: z.string().trim().min(1).max(60),
    areaName: z.string().trim().min(1).max(80),
    supportPhone: z.string().trim().max(20),
    pincodes: z.array(pincodeSchema),
    openTime: timeString,
    cutoff: timeString,
    deadline: timeString,
    daysAhead: z.number().int().min(1).max(7),
    slots: z.array(slotSchema).min(1, "Keep at least one delivery window."),
    deliveryFee: z.number().min(0).max(10000),
    freeDeliveryFrom: z.number().int().min(0).max(100),
    maxTrays: z.number().int().min(1).max(100),
    targetContribution: z.number().min(0).max(100000),
    codEnabled: z.boolean(),
    onlineEnabled: z.boolean(),
  })
  .refine((s) => s.codEnabled || s.onlineEnabled, { message: "Turn on at least one payment option.", path: ["codEnabled"] })
  .refine((s) => s.openTime < s.cutoff, { message: "The store must open before it closes.", path: ["openTime"] });
export type SettingsInput = z.infer<typeof settingsSchema>;

export const pricingSchema = z.object({
  price: z.number().int().min(1).max(100000),
  costs: z.object({
    farm: z.number().min(0),
    inbound: z.number().min(0),
    packaging: z.number().min(0),
    payment: z.number().min(0),
    delivery: z.number().min(0),
  }),
});

export const scheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.number().int().min(1).max(100000),
});

export const stockAddSchema = z.object({
  trays: z.number().int().min(1).max(10000),
  costPerTray: z.number().min(0),
});

export const stockSetSchema = z.object({
  trays: z.number().int().min(0).max(100000),
  reason: z.string().trim().min(1).max(60),
});

/** Flatten zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const addressSchema = z
  .object({
    label: z.string().trim().min(1).max(20).default("Home"),
    name: z.string().trim().min(2, "Enter the name for delivery.").max(80),
    phone: phoneSchema,
    address: z.string().trim().min(8, "Add your house number, street and area.").max(300),
    landmark: z.string().trim().max(120).default(""),
    pincode: pincodeSchema,
    /** The map pin. Required when saving from the address form. */
    lat: latSchema.nullable().default(null),
    lng: lngSchema.nullable().default(null),
  })
  .refine((a) => (a.lat === null) === (a.lng === null), { path: ["pin"], message: "Drop the pin on the map again." });
export type AddressInput = z.input<typeof addressSchema>;

/** Sign-up details collected right after the first mobile login. */
export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: emailSchema,
  address: z.string().trim().min(8, "Add your house number, street and area.").max(300),
  landmark: z.string().trim().max(120).default(""),
  pincode: pincodeSchema,
  label: z.string().trim().min(1).max(20).default("Home"),
});
export type SignupInput = z.input<typeof signupSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  phone: z.union([z.literal(""), phoneSchema]).optional(),
  email: z.union([z.literal(""), emailSchema]).optional(),
});

/** What the cart sends when a logged-in customer places an order: the address is picked from their book. */
export const checkoutSchema = z.object({
  trays: z.number().int().min(1, "Order at least one tray.").max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a delivery day."),
  slotId: z.string().min(1, "Pick a delivery window."),
  payment: z.enum(["cod", "online"]),
  addressId: z.string().min(1, "Choose a delivery address."),
  notes: z.string().trim().max(200).default(""),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;
