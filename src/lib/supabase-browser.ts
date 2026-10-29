"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase ฝั่ง browser (public key) ใช้แค่ 2 อย่าง:
 * 1. เริ่ม Google login   2. ฟัง realtime
 * อ่าน/เขียนข้อมูลจริงไม่ได้ เพราะ RLS ปิดไว้ — ทุกอย่างผ่าน API ของเรา
 */
let client: SupabaseClient | null = null;

export function browserDb(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createBrowserClient(url, key);
  return client;
}

export const DEV_FAKE_AUTH = process.env.NEXT_PUBLIC_DEV_FAKE_AUTH === "1";

export async function signInWithGoogle(next: string) {
  const sb = browserDb();
  if (!sb) throw new Error("ยังไม่ได้ตั้งค่า Supabase");
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
}
