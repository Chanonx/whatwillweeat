import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client ฝั่ง server — ใช้ secret key (service role) ที่ข้ามกฎ RLS ได้
 * ไฟล์นี้ import "server-only" → ถ้าเผลอ import ในหน้าเว็บ build จะ error ทันที
 * ทำให้ key ลับไม่มีทางหลุดไปที่ browser
 */
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
