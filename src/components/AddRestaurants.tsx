"use client";

import { useState, type FormEvent } from "react";
import { Button, Icon, Input, SectionLabel, Spinner, WaitingBar } from "./ui";
import { MAX_RESTAURANTS_PER_MEMBER, type Member, type Restaurant } from "@/lib/types";

interface Props {
  restaurants: Restaurant[];
  members: Member[];
  meId: string;
  isOwner: boolean;
  ownerName: string;
  onAdd: (name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onNext: () => Promise<void>;
}

const SUGGESTIONS = ["ชาบู", "หมูกระทะ", "ส้มตำ", "ซูชิ", "ก๋วยเตี๋ยว", "พิซซ่า", "ข้าวมันไก่", "สเต๊ก", "ราเมง"];

export function AddRestaurants({ restaurants, members, meId, isOwner, ownerName, onAdd, onRemove, onNext }: Props) {
  const [name, setName] = useState("");
  const [advancing, setAdvancing] = useState(false);
  // Optimistic UI: โชว์ร้านที่เพิ่ง "เพิ่ม/ลบ" ทันที ไม่ต้องรอ server ตอบ
  const [pending, setPending] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string[]>([]);

  const visible = restaurants.filter((r) => !removing.includes(r.id));
  const known = new Set(visible.map((r) => r.name.toLowerCase()));
  const pendingShown = pending.filter((p) => !known.has(p.toLowerCase()));
  const mine = visible.filter((r) => r.addedBy === meId).length + pendingShown.length;
  const full = mine >= MAX_RESTAURANTS_PER_MEMBER;
  const total = visible.length + pendingShown.length;
  const nick = (id: string) => members.find((m) => m.userId === id)?.name ?? "?";

  async function add(value: string) {
    const v = value.trim();
    if (!v || full || known.has(v.toLowerCase()) || pending.includes(v)) return;
    setPending((p) => [...p, v]);
    setName("");
    try {
      await onAdd(v);
    } catch {
      setName((cur) => cur || v); // เพิ่มไม่สำเร็จ → คืนข้อความให้แก้ต่อ
    } finally {
      setPending((p) => p.filter((x) => x !== v));
    }
  }

  async function remove(id: string) {
    setRemoving((r) => [...r, id]);
    try {
      await onRemove(id);
    } finally {
      setRemoving((r) => r.filter((x) => x !== id));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await add(name);
  }

  async function next() {
    setAdvancing(true);
    try {
      await onNext();
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight">อยากกินร้านไหน?</h2>
        <p className="mb-4 text-sm text-muted">
          เสนอได้คนละ {MAX_RESTAURANTS_PER_MEMBER} ร้าน · คุณเสนอแล้ว {mine}
        </p>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            placeholder={full ? "เสนอครบแล้ว" : "ชื่อร้าน หรือประเภทอาหาร"}
            value={name}
            maxLength={50}
            disabled={full}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="send"
          />
          <Button type="submit" disabled={full || !name.trim()} className="shrink-0">
            เพิ่ม
          </Button>
        </form>
        {!full && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.filter((s) => !known.has(s.toLowerCase()) && !pending.includes(s))
              .slice(0, 6)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => add(s)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-muted transition hover:border-ink hover:text-ink active:scale-95"
                >
                  {s}
                </button>
              ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel right={`${total} ร้าน`}>ร้านที่เสนอ</SectionLabel>
        {total === 0 ? (
          <p className="border-y border-line py-8 text-center text-sm text-muted">ยังไม่มีร้าน</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {visible.map((r) => (
              <li key={r.id} className="animate-rise flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="text-xs text-muted">{r.addedBy === meId ? "คุณ" : nick(r.addedBy)}</span>
                </span>
                {(r.addedBy === meId || isOwner) && (
                  <button
                    onClick={() => remove(r.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-soft hover:text-danger"
                    aria-label={`ลบ ${r.name}`}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </li>
            ))}
            {pendingShown.map((p) => (
              <li key={`pending-${p}`} className="animate-rise flex items-center gap-3 py-3 opacity-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p}</span>
                  <span className="text-xs text-muted">กำลังเพิ่ม</span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center text-muted">
                  <Spinner />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
        <Button onClick={next} loading={advancing} disabled={visible.length < 2 || pendingShown.length > 0} className="w-full">
          {visible.length < 2 ? "ต้องมีอย่างน้อย 2 ร้าน" : "ไปขั้นบิดเหรียญ"}
        </Button>
      ) : (
        <WaitingBar who={ownerName} what="ไปขั้นบิดเหรียญ" />
      )}
    </div>
  );
}
