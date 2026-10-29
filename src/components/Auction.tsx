"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Coins, Icon, SectionLabel } from "./ui";
import type { BidView, Member, Restaurant } from "@/lib/types";

interface Props {
  restaurants: Restaurant[];
  members: Member[];
  bidders: string[];
  myBid: BidView | null;
  myCoins: number;
  onBid: (restaurantId: string, amount: number) => Promise<void>;
  onReveal: () => Promise<void>;
}

/**
 * ประมูลแบบปิดซอง: ทุกคนบิดพร้อมกัน ไม่มีใครเห็นของคนอื่นจนกว่าจะเปิดผล
 * (server ไม่ส่งยอดบิดของคนอื่นมาเลย แอบดูใน DevTools ก็ไม่เจอ)
 */
export function Auction({ restaurants, members, bidders, myBid, myCoins, onBid, onReveal }: Props) {
  const [editing, setEditing] = useState(!myBid);
  const [pick, setPick] = useState(myBid?.restaurantId ?? "");
  const [amount, setAmount] = useState(myBid?.amount ?? Math.min(20, myCoins));
  const [busy, setBusy] = useState<"bid" | "reveal" | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);

  useEffect(() => {
    if (amount > myCoins) setAmount(myCoins);
  }, [amount, myCoins]);

  const presets = [...new Set([0, 10, 25, 50, myCoins])].filter((c) => c <= myCoins);
  const everyoneBid = bidders.length >= members.length;

  async function submit() {
    setBusy("bid");
    try {
      await onBid(pick, amount);
      setEditing(false);
    } finally {
      setBusy(null);
    }
  }

  async function reveal() {
    if (!everyoneBid && !confirmReveal) {
      setConfirmReveal(true);
      return;
    }
    setBusy("reveal");
    try {
      await onReveal();
    } finally {
      setBusy(null);
      setConfirmReveal(false);
    }
  }

  const myRestaurant = restaurants.find((r) => r.id === myBid?.restaurantId);

  return (
    <div className="flex flex-col gap-8">
      {editing ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">อยากกินร้านไหนที่สุด?</h2>
          <p className="mb-4 text-sm text-muted">เลือก 1 ร้านแล้วบิดเหรียญ ถ้าร้านนั้นแพ้ คุณไม่เสียเหรียญ</p>

          <div className="mb-6 grid gap-2" role="radiogroup" aria-label="เลือกร้าน">
            {restaurants.map((r) => {
              const on = pick === r.id;
              return (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPick(r.id)}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 text-left transition ${
                    on ? "border-ink bg-white" : "border-line bg-white hover:border-muted"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      on ? "border-ink bg-ink text-white" : "border-line"
                    }`}
                  >
                    {on && <Icon name="check" size={12} />}
                  </span>
                  <span className={on ? "font-medium" : ""}>{r.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex items-end justify-between">
            <span className="text-sm text-muted">บิด (คุณมี {myCoins})</span>
            <Coins value={amount} className="text-3xl font-semibold" />
          </div>
          <input
            type="range"
            min={0}
            max={myCoins}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mb-3 h-8 w-full accent-[#111111]"
            aria-label="จำนวนเหรียญที่บิด"
            disabled={myCoins === 0}
          />
          <div className="mb-6 flex flex-wrap gap-2">
            {presets.map((c) => (
              <button
                key={c}
                onClick={() => setAmount(c)}
                className={`rounded-full border px-3 py-1.5 text-sm tabular-nums transition ${
                  amount === c ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"
                }`}
              >
                {c === myCoins && c > 50 ? `ทั้งหมด ${c}` : c}
              </button>
            ))}
          </div>

          <Button onClick={submit} disabled={!pick} loading={busy === "bid"} className="w-full">
            {pick ? "ยืนยันการบิด" : "เลือกร้านก่อน"}
          </Button>
        </section>
      ) : (
        <section className="flex flex-col items-center border-y border-line py-8 text-center">
          <Icon name="lock" size={22} className="mb-3 text-muted" />
          <p className="font-medium">
            คุณบิด <Coins value={myBid?.amount ?? 0} /> ให้ {myRestaurant?.name}
          </p>
          <p className="text-sm text-muted">เพื่อนมองไม่เห็นจนกว่าจะเปิดผล</p>
          <button onClick={() => setEditing(true)} className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink">
            แก้การบิด
          </button>
        </section>
      )}

      <section>
        <SectionLabel right={`${bidders.length}/${members.length}`}>ใครบิดแล้ว</SectionLabel>
        <ul className="divide-y divide-line border-y border-line">
          {members.map((m) => {
            const done = bidders.includes(m.userId);
            return (
              <li key={m.userId} className="flex items-center gap-3 py-2.5 text-sm">
                <Avatar name={m.name} url={m.avatarUrl} size={28} />
                <span className={`flex-1 truncate ${done ? "" : "text-muted"}`}>{m.name}</span>
                {done ? (
                  <span className="flex items-center gap-1 text-ink">
                    <Icon name="check" size={14} />
                    บิดแล้ว
                  </span>
                ) : (
                  <span className="text-muted">รอ</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-2">
        <Button variant="accent" onClick={reveal} loading={busy === "reveal"} className="w-full">
          {confirmReveal ? `ยังบิดไม่ครบ (${bidders.length}/${members.length}) เปิดผลเลย?` : "เปิดผล"}
        </Button>
        {confirmReveal && (
          <Button variant="ghost" onClick={() => setConfirmReveal(false)}>
            รอเพื่อนก่อน
          </Button>
        )}
      </div>
    </div>
  );
}
