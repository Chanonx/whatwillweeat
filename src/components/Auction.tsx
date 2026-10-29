"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Coins, Icon, SectionLabel, Spinner, WaitingBar } from "./ui";
import type { BidView, Member, Restaurant } from "@/lib/types";

interface Props {
  restaurants: Restaurant[];
  members: Member[];
  bidders: string[];
  myBid: BidView | null;
  myCoins: number;
  meId: string;
  isOwner: boolean;
  ownerName: string;
  onBid: (restaurantId: string, amount: number) => Promise<void>;
  onReveal: () => Promise<void>;
}

/**
 * ประมูลแบบปิดซอง: ทุกคนบิดพร้อมกัน ไม่มีใครเห็นของคนอื่นจนกว่าจะเปิดผล
 * (server ไม่ส่งยอดบิดของคนอื่นมาเลย แอบดูใน DevTools ก็ไม่เจอ)
 */
export function Auction({ restaurants, members, bidders, myBid, myCoins, meId, isOwner, ownerName, onBid, onReveal }: Props) {
  const [editing, setEditing] = useState(!myBid);
  const [pick, setPick] = useState(myBid?.restaurantId ?? "");
  const [amount, setAmount] = useState(myBid?.amount ?? Math.min(20, myCoins));
  const [busy, setBusy] = useState<"bid" | "reveal" | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);

  useEffect(() => {
    if (amount > myCoins) setAmount(myCoins);
  }, [amount, myCoins]);

  const presets = [...new Set([0, 10, 25, 50, myCoins])].filter((c) => c <= myCoins);
  // Optimistic UI: กดยืนยันแล้วล็อกการ์ดทันที ระหว่างรอ server บันทึก
  const saving = busy === "bid";
  const shownBidders = saving && !bidders.includes(meId) ? [...bidders, meId] : bidders;
  const everyoneBid = shownBidders.length >= members.length;

  async function submit() {
    setBusy("bid");
    setEditing(false);
    try {
      await onBid(pick, amount);
    } catch {
      setEditing(true); // บันทึกไม่สำเร็จ → กลับไปหน้าแก้
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

  // ระหว่างบันทึกให้โชว์ค่าที่เพิ่งกด (ข้อมูลจาก server ยังไม่มา)
  const lockedAmount = saving ? amount : (myBid?.amount ?? 0);
  const myRestaurant = restaurants.find((r) => r.id === (saving ? pick : myBid?.restaurantId));

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

          <Button onClick={submit} disabled={!pick} className="w-full">
            {pick ? "ยืนยันการบิด" : "เลือกร้านก่อน"}
          </Button>
        </section>
      ) : (
        <section className="animate-phase flex flex-col items-center border-y border-line py-8 text-center">
          <span className="mb-3 flex h-6 items-center text-muted">
            {saving ? <Spinner className="h-5 w-5" /> : <Icon name="lock" size={22} />}
          </span>
          <p className="font-medium">
            คุณบิด <Coins value={lockedAmount} /> ให้ {myRestaurant?.name}
          </p>
          <p className="text-sm text-muted">{saving ? "กำลังบันทึก..." : "เพื่อนมองไม่เห็นจนกว่าจะเปิดผล"}</p>
          {!saving && (
            <button onClick={() => setEditing(true)} className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink">
              แก้การบิด
            </button>
          )}
        </section>
      )}

      <section>
        <SectionLabel right={`${shownBidders.length}/${members.length}`}>ใครบิดแล้ว</SectionLabel>
        <ul className="divide-y divide-line border-y border-line">
          {members.map((m) => {
            const done = shownBidders.includes(m.userId);
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

      {isOwner ? (
        <div className="flex flex-col gap-2">
          <Button variant="accent" onClick={reveal} loading={busy === "reveal"} disabled={saving} className="w-full">
            {confirmReveal ? `ยังบิดไม่ครบ (${shownBidders.length}/${members.length}) เปิดผลเลย?` : "เปิดผล"}
          </Button>
          {confirmReveal && (
            <Button variant="ghost" onClick={() => setConfirmReveal(false)}>
              รอเพื่อนก่อน
            </Button>
          )}
        </div>
      ) : (
        <WaitingBar who={ownerName} what="เปิดผล" />
      )}
    </div>
  );
}
