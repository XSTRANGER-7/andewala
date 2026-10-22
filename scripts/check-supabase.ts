/* eslint-disable @typescript-eslint/no-unused-expressions -- one-line pass/fail checks in a command-line script */
/**
 * Checks the Supabase setup end to end. Run with: npm run check:supabase
 *
 *  1. The env values are present and look right.
 *  2. The app can reach the database (DATABASE_URL) and the tables exist.
 *  3. Every table has row-level security on, so the public data API can't read it.
 *  4. The public API really refuses to return rows with the publishable key.
 *  5. Which login-code channels Supabase Auth can send, if SUPABASE_AUTH_OTP is used.
 */
import { PrismaClient } from "@prisma/client";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => {
  console.log(`  ✗ ${m}`);
  process.exitCode = 1;
};
const info = (m: string) => console.log(`  · ${m}`);

const TABLES = ["StoreConfig", "Order", "AuditLog", "Subscriber", "User", "Address", "Session", "OtpCode", "PaymentAttempt", "DeliveryZone", "Rider"];

async function main() {
  console.log("\n1. Environment");
  const db = process.env.DATABASE_URL ?? "";
  const direct = process.env.DIRECT_URL ?? "";
  const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
  db.startsWith("postgres") ? ok("DATABASE_URL is a Postgres URL") : bad("DATABASE_URL must be the Supabase Postgres connection string");
  db.includes("[YOUR-PASSWORD]") || direct.includes("[YOUR-PASSWORD]") ? bad("Replace [YOUR-PASSWORD] with your database password") : ok("No password placeholder left");
  db.includes(":6543") && !db.includes("pgbouncer=true") ? bad("Pooled URL on port 6543 needs ?pgbouncer=true") : ok("Pooler settings look right");
  direct.startsWith("postgres") ? ok("DIRECT_URL is set (used for creating tables)") : bad("DIRECT_URL must be the Supabase session/direct connection string");
  /^https?:\/\//.test(url) ? ok(`SUPABASE_URL ${url}`) : info("SUPABASE_URL not set (only needed for the API check and Supabase login codes)");
  key ? ok("SUPABASE_PUBLISHABLE_KEY is set") : info("SUPABASE_PUBLISHABLE_KEY not set");
  (process.env.AUTH_SECRET ?? "").length >= 32 ? ok("AUTH_SECRET is long enough") : bad("AUTH_SECRET should be 32+ random characters");

  console.log("\n2. Database");
  const prisma = new PrismaClient();
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    ok(`Connected in ${Date.now() - t0} ms`);
    const rows = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`;
    const found = new Map(rows.map((r) => [r.tablename, r.rowsecurity]));
    const missing = TABLES.filter((t) => !found.has(t));
    missing.length ? bad(`Missing tables: ${missing.join(", ")}. Run: npm run db:deploy`) : ok(`All ${TABLES.length} tables exist`);
    const cfg = await prisma.storeConfig.findUnique({ where: { id: 1 } }).catch(() => null);
    cfg ? ok(`Store settings found (${cfg.storeName}, ₹${cfg.price}/tray, ${cfg.stock} trays)`) : bad("No store settings yet. Run: npm run db:seed");

    console.log("\n3. Row-level security");
    const open = TABLES.filter((t) => found.has(t) && !found.get(t));
    open.length ? bad(`RLS is OFF on: ${open.join(", ")}. Run: npm run db:deploy`) : ok("RLS is on for every app table");
  } catch (e) {
    bad(`Could not reach the database: ${e instanceof Error ? e.message.split("\n").slice(-2).join(" ") : e}`);
  } finally {
    await prisma.$disconnect();
  }

  if (url && key) {
    console.log("\n4. Public API (should be locked)");
    for (const t of ["Order", "User", "Address", "PaymentAttempt"]) {
      const res = await fetch(`${url}/rest/v1/${encodeURIComponent(t)}?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).catch(() => null);
      if (!res) {
        bad(`Couldn't reach ${url}`);
        break;
      }
      const text = await res.text();
      if (res.ok && text.trim() !== "[]") bad(`"${t}" is readable through the public API! Run: npm run db:deploy`);
      else ok(`"${t}" is not readable with the publishable key (${res.status}${res.ok ? ", no rows" : ""})`);
    }

    console.log("\n5. Supabase Auth login codes");
    const chans = (process.env.SUPABASE_AUTH_OTP ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).catch(() => null);
    if (!res || !res.ok) bad("Couldn't read Supabase Auth settings (check SUPABASE_URL and the key)");
    else {
      const s = (await res.json()) as { external?: Record<string, boolean>; sms_provider?: string };
      info(`SUPABASE_AUTH_OTP = ${chans.length ? chans.join(", ") : "(off: the app sends codes itself)"}`);
      if (chans.includes("phone")) (s.external?.phone ? ok(`Phone login is enabled in Supabase${s.sms_provider ? ` (SMS via ${s.sms_provider})` : ""}`) : bad("Phone is not enabled in Supabase: Authentication > Providers > Phone"));
      if (chans.includes("email")) (s.external?.email ? ok("Email login is enabled in Supabase") : bad("Email is not enabled in Supabase: Authentication > Providers > Email"));
    }
  }

  console.log(process.exitCode ? "\nSome checks failed. Fix the ✗ lines above.\n" : "\nAll checks passed.\n");
}

main();
