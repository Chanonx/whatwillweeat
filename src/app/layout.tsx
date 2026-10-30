import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_URL, socialMeta } from "@/lib/site";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...socialMeta(DEFAULT_TITLE, DEFAULT_DESCRIPTION),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${thai.variable} antialiased min-h-dvh`}>{children}</body>
    </html>
  );
}
