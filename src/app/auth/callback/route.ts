import { NextResponse } from "next/server";
import { ensureProfile, getCurrentUser, supabaseAuthClient } from "@/lib/auth";

/**
 * Google login เสร็จ → Google ส่งกลับมาที่นี่พร้อม ?code=...
 * เราแลก code เป็น session (เก็บใน cookie) แล้วพากลับไปหน้าที่ผู้ใช้มาจาก (?next=)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // กัน open redirect: อนุญาตเฉพาะ path ในเว็บเรา
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const sb = await supabaseAuthClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = await getCurrentUser();
      if (user) await ensureProfile(user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/?login_error=1`);
}
