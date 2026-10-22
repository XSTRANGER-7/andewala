import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/server/auth";
import { MODE_COOKIE } from "@/server/mode";

/** Gate every /admin page behind the signed session cookie. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // In rider mode the whole interface is the rider dashboard; shop pages lead there.
  if (!pathname.startsWith("/admin")) {
    if (request.cookies.get(MODE_COOKIE)?.value !== "rider") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/rider";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === "/admin/login") return NextResponse.next();
  const session = await verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
  if (session) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/", "/cart", "/orders", "/order/:path*", "/account", "/account/:path*"],
};
