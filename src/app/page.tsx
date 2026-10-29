"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CoinRules } from "@/components/CoinRules";
import { LoginButton } from "@/components/LoginButton";
import { DashboardSkeleton } from "@/components/Skeletons";
import { Avatar, Button, Coins, ErrorText, Icon, Input, SectionLabel } from "@/components/ui";
import { api } from "@/lib/client";
import type { GroupSummary, Me } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<{ user: Me | null; groups: GroupSummary[] } | null>(null);

  const load = useCallback(() => {
    api.me().then(setData).catch(() => setData({ user: null, groups: [] }));
  }, []);
  useEffect(load, [load]);

  if (!data) return <DashboardSkeleton />;
  return data.user ? <div className="animate-phase"><Dashboard user={data.user} groups={data.groups} /></div> : <div className="animate-phase"><Landing onLogin={load} /></div>;
}

// ---------------------------------------------------------------- landing

function Landing({ onLogin }: { onLogin: () => void }) {
  const steps = [
    ["สร้างกลุ่ม", "ส่งลิงก์ชวนเพื่อนทาง LINE"],
    ["เสนอร้าน", "ทุกคนเสนอร้านที่อยากกิน"],
    ["บิดเหรียญ", "อยากกินมาก บิดเยอะ"],
    ["ได้ร้าน", "ไม่ต้องเถียงกันอีกต่อไป"],
  ];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-16">
      <header className="mb-10">
        <p className="mb-3 text-sm text-muted">WhatWillWeEat</p>
        <h1 className="text-[2.75rem] font-semibold leading-[1.1] tracking-tight">
          กินอะไรดี<span className="text-accent">?</span>
        </h1>
        <p className="mt-4 max-w-xs leading-relaxed text-muted">
          เลิกถาม &ldquo;แล้วแต่&rdquo; ให้ทั้งกลุ่มประมูลด้วยเหรียญ ใครอยากกินที่สุดได้เลือก
        </p>
      </header>

      <div className="mb-12">
        <LoginButton next="/" onDone={onLogin} />
        <p className="mt-3 text-center text-xs text-muted">ฟรี · ไม่ใช้เงินจริง เหรียญเป็นแค่แต้มในเกม</p>
      </div>

      <section className="mb-12">
        <SectionLabel>วิธีใช้</SectionLabel>
        <ol className="divide-y divide-line border-y border-line">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex items-baseline gap-4 py-4">
              <span className="w-6 text-sm tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1">
                <span className="block font-medium">{t}</span>
                <span className="text-sm text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionLabel>กติกาเหรียญ</SectionLabel>
        <CoinRules />
      </section>
    </main>
  );
}

// -------------------------------------------------------------- dashboard

function Dashboard({ user, groups }: { user: Me; groups: GroupSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(groups.length === 0);

  async function create(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { id } = await api.createGroup(name);
      router.push(`/g/${id}?new=1`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    location.reload();
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-6">
      <header className="mb-10 flex items-center gap-3">
        <Avatar name={user.name} url={user.avatarUrl} size={36} />
        <span className="flex-1 truncate font-medium">{user.name}</span>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <Icon name="logout" size={16} />
          ออกจากระบบ
        </button>
      </header>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">กลุ่มของฉัน</h1>

      {groups.length > 0 && (
        <ul className="mb-6 divide-y divide-line border-y border-line">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/g/${g.id}`} className="flex items-center gap-4 py-4 transition hover:opacity-70">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{g.name}</span>
                    {g.hasOpenMeal && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="กำลังเลือกร้าน" />}
                  </span>
                  <span className="text-sm text-muted">
                    {g.memberCount} คน{g.hasOpenMeal ? " · กำลังเลือกร้าน" : ""}
                  </span>
                </span>
                <Coins value={g.myCoins} className="text-sm text-muted" />
                <Icon name="chevron" size={16} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <form onSubmit={create} className="flex flex-col gap-3">
          <label className="text-sm text-muted" htmlFor="group-name">
            ตั้งชื่อกลุ่มใหม่ เช่น เพื่อนมหาลัย, ทีมที่ทำงาน
          </label>
          <Input
            id="group-name"
            autoFocus
            maxLength={40}
            placeholder="ชื่อกลุ่ม"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} disabled={!name.trim()} className="w-full">
            สร้างกลุ่ม
          </Button>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setCreating(true)} className="w-full">
          <Icon name="plus" size={16} />
          สร้างกลุ่มใหม่
        </Button>
      )}

      <p className="mt-8 text-center text-sm text-muted">ได้ลิงก์เชิญจากเพื่อน? กดลิงก์นั้นได้เลย</p>
    </main>
  );
}
