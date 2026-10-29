import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
});

export const metadata: Metadata = {
  title: "WhatWillWeEat — กินอะไรดี?",
  description: "สร้างกลุ่ม ชวนเพื่อน เสนอร้าน แล้วประมูลด้วยเหรียญ ใครอยากกินที่สุดได้เลือก",
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
