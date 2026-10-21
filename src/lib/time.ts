/**
 * All store logic runs on India time (IST). These helpers never depend on the
 * server's or browser's local timezone.
 */
export const TIME_ZONE = "Asia/Kolkata";

export type IstNow = { date: string; minutes: number };

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Current IST calendar date (YYYY-MM-DD) and minutes since midnight. */
export function nowIst(d: Date = new Date()): IstNow {
  const p: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(d)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
  };
}

/** Add n days to a YYYY-MM-DD string. */
export function addDays(ds: string, n: number): string {
  const d = new Date(ds + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Tue, 21 Oct" */
export function fmtDay(ds: string): string {
  return new Date(ds + "T00:00:00Z").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Today", "Tomorrow" or the weekday name, relative to the given IST date. */
export function relativeDay(ds: string, today: string): string {
  if (ds === today) return "Today";
  if (ds === addDays(today, 1)) return "Tomorrow";
  return fmtDay(ds).split(",")[0];
}

/** "17:30" -> 1050 */
export function toMinutes(t: string): number {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "17:00" -> "5 PM", "17:30" -> "5:30 PM" */
export function fmtTime(t: string): string {
  const m = toMinutes(t);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** "21 Oct, 6:42 pm" in IST, or an em dash when missing. */
export function fmtWhen(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
