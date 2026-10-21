import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["500", "700", "800"] });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", weight: ["400", "500", "600", "700"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["500", "700"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "AndeWala · Farm-fresh eggs, delivered same day", template: "%s · AndeWala" },
  description: "30-egg trays at today's fair farm price, delivered to your door by evening. Order before the cutoff for same-day delivery.",
  openGraph: { type: "website", siteName: "AndeWala", title: "AndeWala", description: "Farm-fresh 30-egg trays delivered same day." },
};

export const viewport: Viewport = {
  themeColor: "#1f4d3f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable} ${jetbrains.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
