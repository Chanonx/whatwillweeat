"use client";

import { useState, type FormEvent } from "react";
import { Button, Icon, Input, SectionLabel } from "./ui";
import { MAX_RESTAURANTS_PER_MEMBER, type Member, type Restaurant } from "@/lib/types";

interface Props {
  restaurants: Restaurant[];
  members: Member[];
  meId: string;
  isMealOwner: boolean;
  onAdd: (name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onNext: () => Promise<void>;
}

const SUGGESTIONS = ["ชาบู", "หมูกระทะ", "ส้มตำ", "ซูชิ", "ก๋วยเตี๋ยว", "พิซซ่า", "ข้าวมันไก่", "สเต๊ก", "ราเมง"];

export function AddRestaurants({ restaurants, members, meId, isMealOwner, onAdd, onRemove, onNext }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const mine = restaurants.filter((r) => r.addedBy === meId).length;
  const full = mine >= MAX_RESTAURANTS_PER_MEMBER;
  const nick = (id: string) => members.find((m) => m.userId === id)?.name ?? "?";
  const taken = new Set(restaurants.map((r) => r.name.toLowerCase()));

  async function add(value: string) {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(value);
      setName("");
    } finally {
      setBusy(false);
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
          <Button type="submit" loading={busy} disabled={full || !name.trim()} className="shrink-0">
            เพิ่ม
          </Button>
        </form>
        {!full && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()))
              .slice(0, 6)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => add(s)}
                  disabled={busy}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-muted transition hover:border-ink hover:text-ink disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel right={`${restaurants.length} ร้าน`}>ร้านที่เสนอ</SectionLabel>
        {restaurants.length === 0 ? (
          <p className="border-y border-line py-8 text-center text-sm text-muted">ยังไม่มีร้าน</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {restaurants.map((r) => (
              <li key={r.id} className="animate-rise flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="text-xs text-muted">{r.addedBy === meId ? "คุณ" : nick(r.addedBy)}</span>
                </span>
                {(r.addedBy === meId || isMealOwner) && (
                  <button
                    onClick={() => onRemove(r.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-soft hover:text-danger"
                    aria-label={`ลบ ${r.name}`}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button onClick={next} loading={advancing} disabled={restaurants.length < 2} className="w-full">
        {restaurants.length < 2 ? "ต้องมีอย่างน้อย 2 ร้าน" : "ไปขั้นบิดเหรียญ"}
      </Button>
    </div>
  );
}
