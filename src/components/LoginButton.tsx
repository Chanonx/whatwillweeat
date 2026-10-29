"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { DEV_FAKE_AUTH, signInWithGoogle } from "@/lib/supabase-browser";
import { Button, ErrorText, Input } from "./ui";

/** ปุ่ม "เข้าสู่ระบบด้วย Google" (ตอนพัฒนาในเครื่องจะเป็นช่องใส่ชื่อแทน) */
export function LoginButton({ next, onDone }: { next: string; onDone?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devName, setDevName] = useState("");

  async function google() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle(next); // เว็บจะ redirect ไปหน้า Google
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function dev(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.devLogin(devName);
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (DEV_FAKE_AUTH) {
    return (
      <form onSubmit={dev} className="flex flex-col gap-2">
        <p className="text-center text-xs text-muted">โหมดทดสอบในเครื่อง — ใส่ชื่ออะไรก็ได้</p>
        <Input placeholder="ชื่อทดสอบ" value={devName} onChange={(e) => setDevName(e.target.value)} />
        <Button type="submit" loading={loading} disabled={!devName.trim()} className="w-full">
          เข้าสู่ระบบ (dev)
        </Button>
        <ErrorText>{error}</ErrorText>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={google}
        disabled={loading}
        className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-5 text-[15px] font-medium text-ink transition hover:bg-soft active:scale-[0.99] disabled:opacity-50"
      >
        <GoogleIcon />
        {loading ? "กำลังพาไปหน้า Google..." : "เข้าสู่ระบบด้วย Google"}
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
