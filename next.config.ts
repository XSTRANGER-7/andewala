import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy: the page may only load code, frames and data from
 * this site and the few services it really uses (Razorpay checkout, OpenStreetMap
 * tiles and address lookup, OSRM routing, BigDataCloud area names). An injected
 * script tag pointing anywhere else won't run, and other sites can't frame us.
 * Production only: the dev server needs eval for hot reload.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.razorpay.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.razorpay.com https://router.project-osrm.org https://nominatim.openstreetmap.org https://api.bigdatacloud.net https://api-bdc.io",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location for delivery checks, payment for Razorpay; nothing else.
  { key: "Permissions-Policy", value: 'geolocation=(self), camera=(), microphone=(), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")' },
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: csp },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Every page reads live store data, so render dynamically (no cache-components mode).
  cacheComponents: false,
  poweredByHeader: false,
  // Let phones on the same Wi-Fi use the dev server (http://192.168.x.x:3000). Without this, Next blocks
  // its dev scripts for any host but localhost, so pages render but never become interactive.
  // Dev-only: production builds ignore it.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // The dev-only "N" badge sits on top of the phone checkout bar; build errors still show as an overlay.
  devIndicators: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
