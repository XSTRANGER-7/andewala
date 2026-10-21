"use server";

import { prisma } from "@/server/db";
import { emailSchema } from "@/lib/validation";

export type SubscribeState = { ok: boolean; message: string } | null;

export async function subscribeAction(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  try {
    await prisma.subscriber.upsert({ where: { email: parsed.data }, update: {}, create: { email: parsed.data } });
    return { ok: true, message: "You're in. Tomorrow's price lands in your inbox each morning." };
  } catch (e) {
    console.error("subscribe failed", e);
    return { ok: false, message: "That didn't save. Try again in a moment." };
  }
}
