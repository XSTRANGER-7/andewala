import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
