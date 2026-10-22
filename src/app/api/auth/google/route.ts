import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, googleAuthStart, googleEnabled } from "@/server/google";

/** Start "Continue with Google": remember state + PKCE verifier for 10 minutes, then go to Google. */
export async function GET(req: NextRequest) {
  const back = req.nextUrl.clone();
  back.search = "";
  if (!googleEnabled()) {
    back.pathname = "/login";
    return NextResponse.redirect(back);
  }
  const next = req.nextUrl.searchParams.get("next") ?? "/account";
  const safeNext = /^\/(?!\/)[\w\-/?=&.]*$/.test(next) ? next : "/account";
  const { url, cookie } = googleAuthStart(`${req.nextUrl.origin}/api/auth/google/callback`);
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_STATE_COOKIE, `${cookie}.${Buffer.from(safeNext).toString("base64url")}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
