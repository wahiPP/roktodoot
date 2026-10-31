import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "RoktoDoot",
  description: "Find blood donors near the hospital, fast.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#FFF8F7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface font-sans text-on-surface antialiased">
        <Providers>
          <Nav />
          <main className="pb-24 md:pb-8 md:pl-20">{children}</main>
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
