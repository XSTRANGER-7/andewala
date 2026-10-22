import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Sign in with Google (OAuth 2.0 authorization code flow with PKCE).
 * Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Google Cloud Console >
 * APIs & Services > Credentials > OAuth client ID, type "Web application"),
 * with the redirect URI https://<your-site>/api/auth/google/callback.
 * The button only shows when both are set.
 */
const AUTH_URL = () => process.env.GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const USERINFO_URL = () => process.env.GOOGLE_USERINFO_URL ?? "https://openidconnect.googleapis.com/v1/userinfo";

export function googleEnabled(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export const GOOGLE_STATE_COOKIE = "g_oauth";

const b64url = (b: Buffer) => b.toString("base64url");

/** The Google sign-in URL plus the one-time values to keep in a short-lived cookie. */
export function googleAuthStart(redirectUri: string): { url: string; cookie: string } {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `${AUTH_URL()}?${params}`, cookie: `${state}.${verifier}` };
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string };

/** Exchange the code (server to Google, with our secret and the PKCE verifier) and read who signed in. */
export async function googleFinish(code: string, verifier: string, redirectUri: string): Promise<GoogleProfile | null> {
  const tokenRes = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!tokenRes?.ok) return null;
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!token.access_token) return null;
  const infoRes = await fetch(USERINFO_URL(), { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }).catch(() => null);
  if (!infoRes?.ok) return null;
  const u = (await infoRes.json().catch(() => ({}))) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!u.sub || !u.email) return null;
  return { sub: String(u.sub), email: String(u.email).toLowerCase(), emailVerified: u.email_verified === true, name: (u.name ?? "").slice(0, 80) };
}
