import { PrismaClient } from "@prisma/client";

/**
 * Catch the most common setup mistake early with a message that says what to
 * do, instead of Prisma's "invalid domain character" parsing error.
 */
function checkDatabaseUrl(): void {
  const url = process.env.DATABASE_URL ?? "";
  const problems: string[] = [];
  if (!url) problems.push("DATABASE_URL is empty");
  else {
    if (url.includes("[YOUR-PASSWORD]")) problems.push("replace [YOUR-PASSWORD] with your Supabase database password");
    if (url.includes("[REGION]") || url.includes("[PROJECT-REF]")) problems.push("replace the [REGION] / [PROJECT-REF] part of the host with the exact host from Supabase");
    if (!problems.length && /\[|\]/.test(url)) problems.push("remove the [ ] brackets around the values you pasted in");
    if (!/^postgres(ql)?:\/\//.test(url)) problems.push("it must start with postgresql://");
  }
  if (problems.length) {
    throw new Error(
      `Database not configured: ${problems.join("; ")}.\n` +
        "Fix: open .env, copy DATABASE_URL and DIRECT_URL from Supabase dashboard > Connect > ORMs > Prisma, " +
        "then restart `npm run dev`. If your password has symbols like @ # / ? %, URL-encode them (for example @ becomes %40).",
    );
  }
}
checkDatabaseUrl();

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Interactive-transaction limits sized for a cloud database (Supabase) rather than a local file. */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/**
 * Serialise everything that reads and then changes stock or window capacity
 * (placing an order, delivering one). Postgres runs transactions in parallel,
 * so without this two customers could both buy the last tray. The lock is
 * released automatically when the transaction ends.
 */
export async function lockStore(tx: Pick<PrismaClient, "$executeRaw">): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
}
