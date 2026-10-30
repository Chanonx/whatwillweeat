import type { Metadata } from "next";

/** URL หลักของเว็บ (ใช้สร้างลิงก์เต็มของรูป preview ตอนแชร์ลิงก์) */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const SITE_NAME = "WhatWillWeEat";
export const DEFAULT_TITLE = "WhatWillWeEat — กินอะไรดี?";
export const DEFAULT_DESCRIPTION = "สร้างกลุ่ม ชวนเพื่อน เสนอร้าน แล้วประมูลด้วยเหรียญ ใครอยากกินที่สุดได้เลือก";

/** ข้อมูลที่ LINE / Facebook / Discord ใช้แสดงการ์ด preview ของลิงก์ */
export function socialMeta(title: string, description: string): Metadata {
  const images = [{ url: "/og.png", width: 1200, height: 630, alt: "กินอะไรดี? — WhatWillWeEat" }];
  return {
    title,
    description,
    openGraph: { title, description, siteName: SITE_NAME, locale: "th_TH", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}
