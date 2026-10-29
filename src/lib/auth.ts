import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ApiError } from "./errors";
import { db } from "./supabase-server";

export interface CurrentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * โหมดทดสอบในเครื่อง: login ด้วยชื่ออะไรก็ได้ ไม่ต้องผ่าน Google
 * เปิดได้เฉพาะตอน dev (NODE_ENV !== "production") → บน Vercel ใช้ไม่ได้แน่นอน
 */
export const FAKE_AUTH = process.env.DEV_FAKE_AUTH === "1" && process.env.NODE_ENV !== "production";
const DEV_COOKIE = "dev-user";

/** Supabase client ที่อ่าน/เขียน session จาก cookie (ใช้ตรวจว่าใคร login อยู่) */
export async function supabaseAuthClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // เรียกจาก Server Component เขียน cookie ไม่ได้ → middleware จัดการให้แทน
          }
        },
      },
    },
  );
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (FAKE_AUTH) {
    const raw = (await cookies()).get(DEV_COOKIE)?.value;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CurrentUser;
    } catch {
      return null;
    }
  }

  // getUser() ถาม Supabase Auth ทุกครั้ง → ปลอม cookie ไม่ได้
  const { data } = await (await supabaseAuthClient()).auth.getUser();
  const u = data.user;
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    name: String(meta.full_name ?? meta.name ?? u.email?.split("@")[0] ?? "ผู้ใช้").slice(0, 40),
    avatarUrl: (meta.avatar_url ?? meta.picture ?? null) as string | null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "กรุณาเข้าสู่ระบบก่อน");
  return user;
}

/** สร้าง/อัปเดตโปรไฟล์จากข้อมูล Google (ชื่อ + รูป) */
export async function ensureProfile(user: CurrentUser) {
  const { error } = await db()
    .from("profiles")
    .upsert({ id: user.id, display_name: user.name, avatar_url: user.avatarUrl }, { onConflict: "id" });
  if (error) throw new ApiError(500, error.message);
}

// ------------------------------------------------------- dev-only login

export async function devLogin(name: string) {
  if (!FAKE_AUTH) throw new ApiError(404, "Not found");
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new ApiError(400, "ใส่ชื่อก่อน");
  // ชื่อเดียวกัน → id เดิมเสมอ (สะดวกตอนทดสอบหลายคน)
  const h = createHash("sha256").update(clean).digest("hex");
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const user: CurrentUser = { id, name: clean, avatarUrl: null };
  await ensureProfile(user);
  (await cookies()).set(DEV_COOKIE, JSON.stringify(user), { path: "/", httpOnly: true, sameSite: "lax" });
  return user;
}

export async function logout() {
  if (FAKE_AUTH) {
    (await cookies()).delete(DEV_COOKIE);
    return;
  }
  await (await supabaseAuthClient()).auth.signOut();
}
