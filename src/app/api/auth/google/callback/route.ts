import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { GOOGLE_STATE_COOKIE, googleFinish } from "@/server/google";
import { signInWithGoogle } from "@/server/customer-auth";

/** Back from Google: check state, exchange the code, log in (or create/link the account). */
export async function GET(req: NextRequest) {
  const out = (path: string, error?: string) => {
    const u = req.nextUrl.clone();
    u.pathname = path;
    u.search = error ? `?google=${encodeURIComponent(error)}` : "";
    const res = NextResponse.redirect(u);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };
  const [state, verifier, nextB64] = (req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "").split(".");
  const got = req.nextUrl.searchParams.get("state") ?? "";
  const code = req.nextUrl.searchParams.get("code");
  if (!state || !verifier || !code || got.length !== state.length || !timingSafeEqual(Buffer.from(got), Buffer.from(state))) {
    return out("/login", "expired");
  }
  const profile = await googleFinish(code, verifier, `${req.nextUrl.origin}/api/auth/google/callback`);
  if (!profile) return out("/login", "failed");
  if (!profile.emailVerified) return out("/login", "unverified");
  const r = await signInWithGoogle(profile);
  if (!r.ok) return out("/login", "failed");
  let next = "/account";
  try {
    next = Buffer.from(nextB64 ?? "", "base64url").toString() || "/account";
  } catch {
    /* keep default */
  }
  // Riders choose a mode; an unfinished profile (no verified mobile yet) goes to the details step.
  if (r.rider) return out("/mode");
  if (!r.complete) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = `?next=${encodeURIComponent(/^\/(?!\/)/.test(next) ? next : "/account")}`;
    const res = NextResponse.redirect(u);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  }
  return out(/^\/(?!\/)/.test(next) ? next.split("?")[0] : "/account");
}
