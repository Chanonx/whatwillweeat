"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AddRestaurants } from "@/components/AddRestaurants";
import { Auction } from "@/components/Auction";
import { CoinRules } from "@/components/CoinRules";
import { Result } from "@/components/Result";
import { GroupSkeleton } from "@/components/Skeletons";
import { Avatar, Button, Coins, Icon, SectionLabel, Toast } from "@/components/ui";
import { useGroup } from "@/hooks/useGroup";
import { api } from "@/lib/client";
import { COINS } from "@/lib/logic";
import type { Action } from "@/lib/types";

export default function GroupPageWrapper() {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <GroupPage />
    </Suspense>
  );
}

function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const { state, error, live, refresh } = useGroup(id);
  const [toast, setToast] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(isNew);
  const closeToast = useCallback(() => setToast(null), []);

  // จำว่าเห็นช่วง "bidding" มาก่อนไหม → ถ้าใช่ ตอนจบให้เล่นอนิเมชันลุ้นผล
  const sawBidding = useRef<string | null>(null);
  const mealStatus = state?.meal?.status;
  const mealId = state?.meal?.id;
  useEffect(() => {
    if (mealStatus === "bidding" && mealId) sawBidding.current = mealId;
  }, [mealStatus, mealId]);

  const act = useCallback(
    async (action: Action) => {
      try {
        await api.act(id, action);
        await refresh();
      } catch (e) {
        setToast((e as Error).message);
        await refresh();
        throw e;
      }
    },
    [id, refresh],
  );
  // ปุ่มทั่วไปไม่ต้องจัดการ error เอง (toast แสดงให้แล้ว)
  const safe = (action: Action) => act(action).catch(() => {});

  if (error && !state) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-medium">{error.message}</p>
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          กลับหน้าแรก
        </Link>
      </main>
    );
  }
  if (!state) return <GroupSkeleton />;

  const { group, members, meal, meId, history } = state;
  const me = members.find((m) => m.userId === meId);
  const step = !meal ? 0 : meal.status === "adding" ? 1 : meal.status === "bidding" ? 2 : 3;
  // เจ้าของมื้อ = คนที่กดเริ่มมื้อนี้ → คนเดียวที่ไปขั้นถัดไป / ยกเลิกได้
  const isOwner = meal?.createdBy === meId;
  const ownerName = members.find((m) => m.userId === meal?.createdBy)?.name ?? "เจ้าของมื้อ";

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-16 pt-4">
      {/* ---------- header */}
      <header className="mb-6 flex items-center gap-2">
        <Link
          href="/"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink"
          aria-label="กลับ"
        >
          <Icon name="back" size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{group.name}</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green-600" : "bg-line"}`} />
            {live ? "อัปเดตสด" : "กำลังซิงก์"} · {members.length} คน
          </p>
        </div>
        {me && <Coins value={me.coins} className="text-sm" />}
      </header>

      {/* ---------- members */}
      <section className="mb-6 flex gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => setShowInvite((s) => !s)}
          className="flex w-12 shrink-0 flex-col items-center gap-1.5 text-xs text-muted hover:text-ink"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-muted">
            <Icon name="plus" size={16} />
          </span>
          ชวน
        </button>
        {members.map((m) => (
          <div key={m.userId} className="flex w-12 shrink-0 flex-col items-center gap-1.5 text-xs">
            <Avatar name={m.name} url={m.avatarUrl} size={40} />
            <span className="w-full truncate text-center">{m.userId === meId ? "คุณ" : m.name}</span>
            <span className="-mt-1 tabular-nums text-muted">{m.coins}</span>
          </div>
        ))}
      </section>

      {showInvite && (
        <InvitePanel inviteCode={group.inviteCode} groupName={group.name} onClose={() => setShowInvite(false)} />
      )}

      {step > 0 && <Stepper step={step} />}
      {meal && meal.status !== "done" && (
        <p className="-mt-5 mb-8 text-xs text-muted">
          {isOwner ? "คุณเป็นคนเริ่มมื้อนี้ — กดไปขั้นถัดไปได้เมื่อพร้อม" : `${ownerName} เป็นคนเริ่มมื้อนี้`}
        </p>
      )}

      {/* ---------- main stage */}
      {/* key เปลี่ยนทุกครั้งที่เปลี่ยนเฟส → React สร้างใหม่ → เล่นอนิเมชัน phase-in */}
      <section key={`${meal?.id ?? "none"}-${meal?.status ?? "none"}`} className="animate-phase mb-12">
        {!meal && (
          <div className="border-y border-line py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">หิวแล้วหรือยัง?</h2>
            <p className="mb-6 mt-2 text-sm text-muted">
              เริ่มมื้อใหม่ ทุกคนในกลุ่มได้รับ +{COINS.MEAL_BONUS} เหรียญ
            </p>
            <StartMealButton onStart={() => safe({ type: "start_meal" })} />
          </div>
        )}

        {meal?.status === "adding" && (
          <AddRestaurants
            restaurants={meal.restaurants}
            members={members}
            meId={meId}
            isOwner={isOwner}
            ownerName={ownerName}
            onAdd={(name) => act({ type: "add_restaurant", name })}
            onRemove={(restaurantId) => safe({ type: "remove_restaurant", restaurantId })}
            onNext={() => safe({ type: "start_bidding" })}
          />
        )}

        {meal?.status === "bidding" && (
          <Auction
            key={meal.id}
            restaurants={meal.restaurants}
            members={members}
            bidders={meal.bidders}
            myBid={meal.myBid}
            myCoins={me?.coins ?? 0}
            meId={meId}
            isOwner={isOwner}
            ownerName={ownerName}
            onBid={(restaurantId, amount) => act({ type: "place_bid", restaurantId, amount })}
            onReveal={() => safe({ type: "reveal" })}
          />
        )}

        {meal?.status === "done" && meal.result && (
          <Result
            key={meal.id}
            meal={meal}
            members={members}
            suspense={sawBidding.current === meal.id}
            onNewMeal={() => safe({ type: "start_meal" })}
          />
        )}

        {isOwner && (meal?.status === "adding" || meal?.status === "bidding") && (
          <div className="mt-4 text-center">
            <CancelMeal onCancel={() => safe({ type: "cancel_meal" })} />
          </div>
        )}
      </section>

      {/* ---------- history */}
      {history.length > 0 && (
        <section className="mb-12">
          <SectionLabel>มื้อก่อน ๆ</SectionLabel>
          <ul className="divide-y divide-line border-y border-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-3 text-sm">
                <span>{h.winnerName}</span>
                <span className="text-muted">
                  {new Date(h.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-wider text-muted">
          กติกาเหรียญ
          <Icon name="chevron" size={14} className="transition group-open:rotate-90" />
        </summary>
        <div className="mt-3">
          <CoinRules />
        </div>
      </details>

      <Toast message={toast} onClose={closeToast} />
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["เสนอร้าน", "บิดเหรียญ", "ผลลัพธ์"];
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="ขั้นตอน">
      {labels.map((l, i) => {
        const n = i + 1;
        return (
          <li key={l} className="flex flex-col gap-1.5 text-xs">
            <span className="h-0.5 w-full overflow-hidden rounded-full bg-line">
              <span
                className="block h-full bg-ink transition-transform duration-500 ease-out"
                style={{ transform: `scaleX(${n <= step ? 1 : 0})`, transformOrigin: "left" }}
              />
            </span>
            <span className={n === step ? "font-medium text-ink" : "text-muted"}>
              {n}. {l}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function InvitePanel({ inviteCode, groupName, onClose }: { inviteCode: string; groupName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${location.origin}/join/${inviteCode}` : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function share() {
    try {
      await navigator.share({ title: "กินอะไรดี?", text: `มาเลือกร้านกับกลุ่ม "${groupName}" กัน`, url });
    } catch {}
  }

  return (
    <section className="animate-rise mb-8 rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">ชวนเพื่อนเข้ากลุ่ม</h3>
          <p className="text-sm text-muted">ส่งลิงก์นี้ให้เพื่อน กดครั้งเดียวเข้ากลุ่มได้เลย</p>
        </div>
        <button onClick={onClose} className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-soft" aria-label="ปิด">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="mb-3 truncate rounded-lg bg-soft px-3 py-2.5 font-mono text-xs text-muted" data-testid="invite-url">
        {url}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={copy}>
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </Button>
        {canShare ? (
          <Button onClick={share}>
            <Icon name="share" size={16} />
            แชร์
          </Button>
        ) : (
          <a
            href={`https://line.me/R/msg/text/?${encodeURIComponent(`มาเลือกร้านกัน ${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink text-[15px] font-medium text-white hover:bg-ink/85"
          >
            ส่งทาง LINE
          </a>
        )}
      </div>
    </section>
  );
}

function CancelMeal({ onCancel }: { onCancel: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="text-sm text-muted hover:text-ink">
        ยกเลิกมื้อนี้
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-4 text-sm">
      <span className="text-muted">ยกเลิกมื้อนี้?</span>
      <button onClick={onCancel} className="font-medium text-danger">
        ยกเลิก
      </button>
      <button onClick={() => setConfirm(false)} className="text-muted hover:text-ink">
        ไม่
      </button>
    </span>
  );
}

function StartMealButton({ onStart }: { onStart: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await onStart();
        } finally {
          setLoading(false);
        }
      }}
      className="w-full"
    >
      เริ่มมื้อใหม่
    </Button>
  );
}
