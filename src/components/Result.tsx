"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Coins, Icon, SectionLabel } from "./ui";
import type { Meal, Member } from "@/lib/types";

interface Props {
  meal: Meal;
  members: Member[];
  /** เล่นอนิเมชันลุ้นผล (เฉพาะคนที่อยู่ในหน้าตอนกดเปิดผล) */
  suspense: boolean;
  onNewMeal: () => Promise<void>;
}

export function Result({ meal, members, suspense, onNewMeal }: Props) {
  const [revealing, setRevealing] = useState(suspense);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const result = meal.result!;
  const winner = meal.restaurants.find((r) => r.id === result.winnerId);
  const memberOf = (id: string) => members.find((m) => m.userId === id);

  // ลุ้นผล 2.4 วิ: สลับชื่อร้านไปเรื่อย ๆ แล้วหยุดที่ผู้ชนะ
  useEffect(() => {
    if (!revealing) return;
    const spin = setInterval(() => setTick((t) => t + 1), 110);
    const stop = setTimeout(() => setRevealing(false), 2400);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [revealing]);

  if (revealing) {
    const shuffled = meal.restaurants[tick % meal.restaurants.length];
    return (
      <section className="border-y border-line py-16 text-center">
        <p className="mb-3 text-sm text-muted">กำลังเปิดผล</p>
        <p className="text-3xl font-semibold tracking-tight text-muted">{shuffled?.name}</p>
      </section>
    );
  }

  // ยอดรวมต่อร้าน: ร้านที่ชนะขึ้นก่อน ที่เหลือเรียงจากมากไปน้อย
  const totals = meal.restaurants
    .map((r) => ({
      ...r,
      total: result.bids.filter((b) => b.restaurantId === r.id).reduce((s, b) => s + b.amount, 0),
      bids: result.bids.filter((b) => b.restaurantId === r.id),
    }))
    .sort((a, b) => Number(b.id === result.winnerId) - Number(a.id === result.winnerId) || b.total - a.total);
  const max = Math.max(1, ...totals.map((t) => t.total));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(winner?.name ?? "")}`;

  async function newMeal() {
    setBusy(true);
    try {
      await onNewMeal();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="animate-rise">
        <p className="text-sm text-muted">มื้อนี้ไปกินที่</p>
        <h2 className="mt-1 text-4xl font-semibold tracking-tight">{winner?.name}</h2>
        {result.wasTie && <p className="mt-2 text-sm text-muted">คะแนนเสมอกัน ระบบสุ่มให้</p>}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[15px] font-medium text-white transition hover:bg-ink/85"
        >
          <Icon name="pin" size={16} />
          เปิดใน Google Maps
        </a>
      </section>

      <section>
        <SectionLabel>ผลการบิด</SectionLabel>
        <ul className="divide-y divide-line border-y border-line">
          {totals.map((t) => {
            const won = t.id === result.winnerId;
            return (
              <li key={t.id} className="py-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className={won ? "font-medium" : "text-muted"}>{t.name}</span>
                  <Coins value={t.total} className={won ? "text-accent" : "text-muted"} />
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-soft">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${won ? "bg-accent" : "bg-line"}`}
                    style={{ width: `${(t.total / max) * 100}%` }}
                  />
                </div>
                {t.bids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                    {t.bids.map((b) => {
                      const m = memberOf(b.userId);
                      return (
                        <span key={b.userId} className="inline-flex items-center gap-1.5 text-xs text-muted">
                          <Avatar name={m?.name ?? "?"} url={m?.avatarUrl} size={18} />
                          {m?.name} · {b.amount}
                          {won && b.amount > 0 ? " (จ่าย)" : ""}
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">คนที่บิดร้านที่แพ้ไม่เสียเหรียญ</p>
      </section>

      <Button onClick={newMeal} loading={busy} variant="secondary" className="w-full">
        เริ่มมื้อใหม่
      </Button>
    </div>
  );
}
