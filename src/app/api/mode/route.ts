import { NextResponse, type NextRequest } from "next/server";
import { MODE_COOKIE } from "@/server/mode";
import { getRider } from "@/server/riders";

/**
 * Switch between the shop and rider mode: /api/mode?to=rider | shop.
 * Rider mode is only for a logged-in, active delivery partner.
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") === "rider" ? "rider" : "shop";
  const url = req.nextUrl.clone();
  url.search = "";
  if (to === "rider" && !(await getRider())) {
    url.pathname = "/login";
    url.searchParams.set("next", "/mode");
    return NextResponse.redirect(url);
  }
  url.pathname = to === "rider" ? "/rider" : "/";
  const res = NextResponse.redirect(url);
  res.cookies.set(MODE_COOKIE, to, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  return res;
}
