import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Customer passwords, stored only as scrypt hashes (a deliberately slow,
 * salted, memory-hard hash). Format: scrypt$N$r$p$<salt b64>$<hash b64>.
 */
const N = 16384, R = 8, P = 1, KEYLEN = 64;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, KEYLEN, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Constant-time check. A missing hash still costs one scrypt, so "no such account" and "wrong password" take the same time. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    await derive(password, randomBytes(16), { N, r: R, p: P });
    return false;
  }
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const key = await derive(password, Buffer.from(saltB64, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
