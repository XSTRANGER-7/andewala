import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient;

/** Record an admin change. Pass the transaction client when called inside a transaction (SQLite holds one write lock). */
export async function logAudit(by: string, action: string, detail = "", tx: Tx = prisma): Promise<void> {
  // Inside a transaction, let a failure propagate: Postgres cancels the rest of a
  // transaction after any error, so swallowing it here would hide a broken update.
  if (tx !== prisma) {
    await tx.auditLog.create({ data: { by, action, detail } });
    return;
  }
  try {
    await prisma.auditLog.create({ data: { by, action, detail } });
  } catch (e) {
    console.warn("audit log failed", e);
  }
}

export async function listAudit(limit = 200) {
  const rows = await prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: limit });
  return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), by: r.by, action: r.action, detail: r.detail }));
}
