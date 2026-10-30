import "server-only";
import { randomInt } from "node:crypto";
import type { CurrentUser } from "./auth";
import { ensureProfile } from "./auth";
import { ApiError } from "./errors";
import {
  COINS,
  generateInviteCode,
  isStale,
  lastActivityAt,
  MEAL_STALE_MINUTES,
  mealBonus,
  normalizeName,
  resolveAuction,
  type Rng,
} from "./logic";
import { db } from "./supabase-server";
import {
  MAX_MEMBERS,
  MAX_RESTAURANTS_PER_MEMBER,
  type Action,
  type BidView,
  type GroupState,
  type GroupSummary,
  type Meal,
  type MealStatus,
} from "./types";

/** สุ่มแบบปลอดภัย (crypto) แทน Math.random — เดาผลไม่ได้ */
const secureRng: Rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Res<T> = { data: T; error: { message: string; code?: string } | null };

function check<T>(res: Res<T>): T {
  if (res.error) throw new ApiError(500, res.error.message);
  return res.data;
}

function checkRow<T>(res: Res<T | null>): T {
  const data = check(res);
  if (data === null) throw new ApiError(500, "ไม่ได้รับข้อมูลจากฐานข้อมูล");
  return data;
}

interface MealRow {
  id: string;
  group_id: string;
  status: MealStatus;
  created_by: string;
  winner_restaurant_id: string | null;
  was_tie: boolean;
  created_at: string;
}

// ================================================================ coins

/** ยอดเหรียญ = ผลรวม delta ทั้งหมดในสมุดบัญชี */
async function balances(groupId: string): Promise<Record<string, number>> {
  const rows = check(
    await db().from("coin_ledger").select("user_id, delta").eq("group_id", groupId),
  ) as { user_id: string; delta: number }[];
  const out: Record<string, number> = {};
  for (const r of rows ?? []) out[r.user_id] = (out[r.user_id] ?? 0) + r.delta;
  return out;
}

// ======================================================= optimistic lock

class ConflictError extends ApiError {
  constructor() {
    super(409, "มีคนกดพร้อมกัน ลองอีกครั้ง");
  }
}

async function readVersion(groupId: string): Promise<number> {
  const row = checkRow(
    await db().from("group_signals").select("version").eq("group_id", groupId).maybeSingle(),
  ) as { version: number };
  return row.version;
}

/**
 * จองสิทธิ์แก้ไขกลุ่ม (optimistic locking)
 *   UPDATE group_signals SET version = v+1 WHERE group_id = ? AND version = v
 * ถ้ามีคนแก้ไปก่อน version จะไม่ตรง → อัปเดตได้ 0 แถว → conflict → ลองใหม่
 * การอัปเดตนี้ยังเป็น "กริ่ง realtime" ให้ทุกจอโหลดข้อมูลใหม่ด้วย
 */
async function claim(groupId: string, version: number) {
  const rows = check(
    await db()
      .from("group_signals")
      .update({ version: version + 1 })
      .eq("group_id", groupId)
      .eq("version", version)
      .select("group_id"),
  );
  if (!rows || rows.length === 0) throw new ConflictError();
}

/** กดกริ่งอีกรอบหลังเขียนข้อมูลเสร็จ → จอที่โหลดเร็วไปจะได้ข้อมูลล่าสุด */
async function bump(groupId: string, version: number) {
  await db()
    .from("group_signals")
    .update({ version: version + 2 })
    .eq("group_id", groupId)
    .eq("version", version + 1);
}

/** ชนกับคนอื่น → รอแป๊บแล้วลองใหม่ (สูงสุด 5 ครั้ง) */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ConflictError) || attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 80 * (attempt + 1)));
    }
  }
}

// ============================================================ validation

function clean(raw: unknown, max: number, what: string): string {
  const s = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (s.length < 1 || s.length > max) throw new ApiError(400, `${what}ต้องยาว 1–${max} ตัวอักษร`);
  return s;
}

async function requireMembership(groupId: string, userId: string) {
  if (!UUID.test(groupId)) throw new ApiError(404, "ไม่พบกลุ่มนี้");
  const row = check(
    await db()
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
  if (!row) throw new ApiError(404, "ไม่พบกลุ่มนี้ หรือคุณยังไม่ได้เป็นสมาชิก");
}

// ================================================================ groups

export async function listMyGroups(user: CurrentUser): Promise<GroupSummary[]> {
  const mine = check(
    await db()
      .from("group_members")
      .select("group_id, joined_at, groups(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
  ) as unknown as { group_id: string; groups: { id: string; name: string } }[];
  if (!mine?.length) return [];
  const ids = mine.map((m) => m.group_id);

  const [members, ledger, open] = await Promise.all([
    db().from("group_members").select("group_id").in("group_id", ids).then(check),
    db().from("coin_ledger").select("group_id, delta").in("group_id", ids).eq("user_id", user.id).then(check),
    db().from("meals").select("group_id").in("group_id", ids).in("status", ["adding", "bidding"]).then(check),
  ]);

  return mine.map((m) => ({
    id: m.group_id,
    name: m.groups.name,
    memberCount: (members ?? []).filter((x) => x.group_id === m.group_id).length,
    myCoins: (ledger ?? []).filter((x) => x.group_id === m.group_id).reduce((s, x) => s + x.delta, 0),
    hasOpenMeal: (open ?? []).some((x) => x.group_id === m.group_id),
  }));
}

export async function createGroup(user: CurrentUser, rawName: unknown): Promise<{ id: string }> {
  const name = clean(rawName, 40, "ชื่อกลุ่ม");
  await ensureProfile(user);

  let group: { id: string } | null = null;
  for (let i = 0; i < 5 && !group; i++) {
    const res = await db()
      .from("groups")
      .insert({ name, invite_code: generateInviteCode(secureRng), created_by: user.id })
      .select("id")
      .single();
    if (!res.error) group = res.data;
    else if (res.error.code !== "23505") throw new ApiError(500, res.error.message);
  }
  if (!group) throw new ApiError(503, "สร้างกลุ่มไม่สำเร็จ ลองใหม่อีกครั้ง");

  check(await db().from("group_signals").insert({ group_id: group.id }));
  check(await db().from("group_members").insert({ group_id: group.id, user_id: user.id }));
  check(
    await db()
      .from("coin_ledger")
      .insert({ group_id: group.id, user_id: user.id, delta: COINS.START, reason: "join" }),
  );
  return { id: group.id };
}

/** ข้อมูลกลุ่มแบบย่อ สำหรับหน้าลิงก์เชิญ (ยังไม่ต้อง login ก็ดูได้) */
export async function invitePreview(code: string) {
  const group = check(
    await db().from("groups").select("id, name").eq("invite_code", code).maybeSingle(),
  ) as { id: string; name: string } | null;
  if (!group) throw new ApiError(404, "ลิงก์เชิญนี้ไม่ถูกต้อง หรือกลุ่มถูกลบไปแล้ว");
  const { count } = await db()
    .from("group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", group.id);
  return { name: group.name, memberCount: count ?? 0 };
}

export async function joinByInvite(user: CurrentUser, code: string): Promise<{ id: string }> {
  const group = check(
    await db().from("groups").select("id").eq("invite_code", code).maybeSingle(),
  ) as { id: string } | null;
  if (!group) throw new ApiError(404, "ลิงก์เชิญนี้ไม่ถูกต้อง หรือกลุ่มถูกลบไปแล้ว");
  await ensureProfile(user);

  return withRetry(async () => {
    const already = check(
      await db()
        .from("group_members")
        .select("user_id")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (already) return { id: group.id }; // เป็นสมาชิกอยู่แล้ว → พาเข้ากลุ่มเลย

    const { count } = await db()
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", group.id);
    if ((count ?? 0) >= MAX_MEMBERS) throw new ApiError(409, `กลุ่มเต็มแล้ว (สูงสุด ${MAX_MEMBERS} คน)`);

    const v = await readVersion(group.id);
    await claim(group.id, v);
    check(await db().from("group_members").insert({ group_id: group.id, user_id: user.id }));
    check(
      await db()
        .from("coin_ledger")
        .insert({ group_id: group.id, user_id: user.id, delta: COINS.START, reason: "join" }),
    );
    await bump(group.id, v);
    return { id: group.id };
  });
}

// ========================================================== group state

export async function getGroupState(user: CurrentUser, groupId: string): Promise<GroupState> {
  await requireMembership(groupId, user.id);

  const [group, version, memberRows, coins, meals] = await Promise.all([
    db().from("groups").select("id, name, invite_code").eq("id", groupId).single().then(checkRow),
    readVersion(groupId),
    db()
      .from("group_members")
      .select("user_id, joined_at, profiles(display_name, avatar_url)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true })
      .then(check),
    balances(groupId),
    db()
      .from("meals")
      .select("*")
      .eq("group_id", groupId)
      .in("status", ["adding", "bidding", "done"])
      .order("created_at", { ascending: false })
      .limit(11)
      .then(check),
  ]);

  const mealRows = (meals ?? []) as MealRow[];
  const current = mealRows.find((m) => m.status !== "done") ?? mealRows[0] ?? null;
  const doneMeals = mealRows.filter((m) => m.status === "done");

  // ชื่อร้านที่ชนะของมื้อก่อน ๆ (ประวัติ)
  const winnerIds = doneMeals.map((m) => m.winner_restaurant_id).filter(Boolean) as string[];
  const winners = winnerIds.length
    ? ((check(await db().from("restaurants").select("id, name").in("id", winnerIds)) ?? []) as {
        id: string;
        name: string;
      }[])
    : [];

  const members = (
    (memberRows ?? []) as unknown as {
      user_id: string;
      profiles: { display_name: string; avatar_url: string | null };
    }[]
  ).map((m) => ({
    userId: m.user_id,
    name: m.profiles.display_name,
    avatarUrl: m.profiles.avatar_url,
    coins: coins[m.user_id] ?? 0,
  }));

  const g = group as { id: string; name: string; invite_code: string };
  return {
    meId: user.id,
    group: { id: g.id, name: g.name, inviteCode: g.invite_code, version },
    members,
    meal: current ? await mealView(current, user.id) : null,
    history: doneMeals
      .filter((m) => m.id !== current?.id)
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        winnerName: winners.find((w) => w.id === m.winner_restaurant_id)?.name ?? "?",
        createdAt: m.created_at,
      })),
  };
}

async function mealView(meal: MealRow, meId: string): Promise<Meal> {
  const [restaurants, bids] = await Promise.all([
    db()
      .from("restaurants")
      .select("id, name, added_by, created_at")
      .eq("meal_id", meal.id)
      .order("created_at", { ascending: true })
      .then(check),
    db().from("bids").select("user_id, restaurant_id, amount, created_at").eq("meal_id", meal.id).then(check),
  ]);
  const last = lastActivityAt([
    meal.created_at,
    ...(restaurants ?? []).map((r) => r.created_at as string),
    ...(bids ?? []).map((b) => b.created_at as string),
  ]);
  const open = meal.status === "adding" || meal.status === "bidding";
  const bidViews: BidView[] = (bids ?? []).map((b) => ({
    userId: b.user_id,
    restaurantId: b.restaurant_id,
    amount: b.amount,
  }));

  return {
    id: meal.id,
    status: meal.status,
    createdBy: meal.created_by,
    createdAt: meal.created_at,
    restaurants: (restaurants ?? []).map((r) => ({ id: r.id, name: r.name, addedBy: r.added_by })),
    bidders: bidViews.map((b) => b.userId),
    myBid: bidViews.find((b) => b.userId === meId) ?? null,
    lastActivityAt: new Date(last).toISOString(),
    // เจ้าของมื้อหายไป → มื้อนิ่งเกิน 10 นาที คนอื่นยกเลิกได้ (server เป็นคนตัดสิน ไม่ใช้นาฬิกาเครื่องผู้ใช้)
    staleCancelable: open && isStale(last, Date.now()),
    // ยอดบิดของคนอื่นถูกส่งมาเฉพาะตอนจบแล้ว → แอบดูใน DevTools ก็ไม่เจอ
    result:
      meal.status === "done" && meal.winner_restaurant_id
        ? { winnerId: meal.winner_restaurant_id, wasTie: meal.was_tie, bids: bidViews }
        : null,
  };
}

// ============================================================== actions

export async function performAction(user: CurrentUser, groupId: string, action: Action) {
  await requireMembership(groupId, user.id);

  await withRetry(async () => {
    const v = await readVersion(groupId);
    const open = check(
      await db()
        .from("meals")
        .select("*")
        .eq("group_id", groupId)
        .in("status", ["adding", "bidding"])
        .maybeSingle(),
    ) as MealRow | null;

    const requireMeal = (...s: MealStatus[]): MealRow => {
      if (!open) throw new ApiError(409, "ยังไม่มีมื้อที่เปิดอยู่");
      if (!s.includes(open.status)) throw new ApiError(409, "ทำแบบนี้ในขั้นตอนนี้ไม่ได้ (ลองรีเฟรช)");
      return open;
    };
    // เฉพาะ "เจ้าของมื้อ" (คนที่กดเริ่มมื้อ) ถึงจะพามื้อไปขั้นถัดไป / ยกเลิกได้
    const requireOwner = (meal: MealRow) => {
      if (meal.created_by !== user.id) throw new ApiError(403, "เฉพาะคนที่เริ่มมื้อนี้เท่านั้น");
    };
    const restaurantsOf = async (mealId: string) =>
      (check(
        await db().from("restaurants").select("id, name_key, added_by").eq("meal_id", mealId),
      ) ?? []) as { id: string; name_key: string; added_by: string }[];

    switch (action.type) {
      // -------- เริ่มมื้อใหม่: ทุกคนได้โบนัสเหรียญ
      case "start_meal": {
        if (open) throw new ApiError(409, "มีมื้อที่เปิดอยู่แล้ว");
        await claim(groupId, v);
        const res = await db()
          .from("meals")
          .insert({ group_id: groupId, created_by: user.id })
          .select("id")
          .single();
        if (res.error?.code === "23505") throw new ApiError(409, "มีมื้อที่เปิดอยู่แล้ว");
        const meal = checkRow(res) as { id: string };

        const [bal, members] = await Promise.all([
          balances(groupId),
          db().from("group_members").select("user_id").eq("group_id", groupId).then(check),
        ]);
        const bonuses = (members ?? [])
          .map((m) => ({ user_id: m.user_id as string, delta: mealBonus(bal[m.user_id] ?? 0) }))
          .filter((b) => b.delta > 0)
          .map((b) => ({ ...b, group_id: groupId, meal_id: meal.id, reason: "meal_bonus" }));
        if (bonuses.length) check(await db().from("coin_ledger").insert(bonuses));
        await bump(groupId, v);
        return;
      }

      // -------- ใส่ร้าน
      case "add_restaurant": {
        const meal = requireMeal("adding");
        const name = clean(action.name, 50, "ชื่อร้าน");
        const key = normalizeName(name);
        const list = await restaurantsOf(meal.id);
        if (list.some((r) => r.name_key === key)) throw new ApiError(409, "มีคนใส่ร้านนี้แล้ว");
        if (list.filter((r) => r.added_by === user.id).length >= MAX_RESTAURANTS_PER_MEMBER) {
          throw new ApiError(409, `ใส่ได้คนละไม่เกิน ${MAX_RESTAURANTS_PER_MEMBER} ร้าน`);
        }
        await claim(groupId, v);
        const res = await db()
          .from("restaurants")
          .insert({ meal_id: meal.id, name, name_key: key, added_by: user.id });
        if (res.error?.code === "23505") throw new ApiError(409, "มีคนใส่ร้านนี้แล้ว");
        check(res);
        await bump(groupId, v);
        return;
      }

      case "remove_restaurant": {
        const meal = requireMeal("adding");
        const target = (await restaurantsOf(meal.id)).find((r) => r.id === action.restaurantId);
        if (!target) throw new ApiError(404, "ไม่พบร้านนี้");
        if (target.added_by !== user.id && meal.created_by !== user.id) {
          throw new ApiError(403, "ลบได้เฉพาะร้านที่ตัวเองใส่");
        }
        await claim(groupId, v);
        check(await db().from("restaurants").delete().eq("id", target.id));
        await bump(groupId, v);
        return;
      }

      // -------- ปิดรับร้าน → เริ่มบิด
      case "start_bidding": {
        const meal = requireMeal("adding");
        requireOwner(meal);
        if ((await restaurantsOf(meal.id)).length < 2) {
          throw new ApiError(409, "ต้องมีอย่างน้อย 2 ร้านถึงจะเริ่มบิดได้");
        }
        await claim(groupId, v);
        check(await db().from("meals").update({ status: "bidding" }).eq("id", meal.id).eq("status", "adding"));
        await bump(groupId, v);
        return;
      }

      // -------- บิด (แก้ได้จนกว่าจะเปิดผล)
      case "place_bid": {
        const meal = requireMeal("bidding");
        const amount = Number(action.amount);
        const myCoins = (await balances(groupId))[user.id] ?? 0;
        if (!Number.isInteger(amount) || amount < 0 || amount > myCoins) {
          throw new ApiError(400, `บิดได้ 0–${myCoins} เหรียญ`);
        }
        if (!(await restaurantsOf(meal.id)).some((r) => r.id === action.restaurantId)) {
          throw new ApiError(404, "ไม่พบร้านนี้");
        }
        await claim(groupId, v);
        const saved = await db()
          .from("bids")
          .upsert(
            {
              meal_id: meal.id,
              user_id: user.id,
              restaurant_id: action.restaurantId,
              amount,
              created_at: new Date().toISOString(), // เวลาบิดล่าสุด ใช้นับความเคลื่อนไหวของมื้อ
            },
            { onConflict: "meal_id,user_id" },
          );
        // trigger ใน DB ปฏิเสธ = มื้อถูกเปิดผลไปแล้วระหว่างที่เรากำลังบิด
        if (saved.error?.message?.includes("meal_not_bidding")) {
          throw new ApiError(409, "เปิดผลไปแล้ว บิดไม่ทัน");
        }
        check(saved);
        await bump(groupId, v);
        return;
      }

      // -------- เปิดผล: หาผู้ชนะ + หักเหรียญคนที่บิดร้านที่ชนะ
      case "reveal": {
        const meal = requireMeal("bidding");
        requireOwner(meal);
        await claim(groupId, v);

        // 1) ปิดรับบิดก่อน แบบมีเงื่อนไข status = bidding
        //    → กดเปิดผลซ้ำ: ครั้งที่สองได้ 0 แถว ไม่ทำต่อ (หักเหรียญครั้งเดียว)
        //    → trigger ใน DB ปฏิเสธบิดที่มาหลังจากนี้ ส่วนบิดที่กำลังบันทึกอยู่ การปิดจะรอให้เสร็จก่อน
        const closed = check(
          await db()
            .from("meals")
            .update({ status: "done", closed_at: new Date().toISOString() })
            .eq("id", meal.id)
            .eq("status", "bidding")
            .select("id"),
        );
        if (!closed?.length) {
          await bump(groupId, v);
          return;
        }

        // 2) อ่านบิดหลังปิดแล้ว = ชุดสุดท้ายที่ไม่มีใครเพิ่มได้อีก
        const [list, bids] = await Promise.all([
          restaurantsOf(meal.id),
          db().from("bids").select("user_id, restaurant_id, amount").eq("meal_id", meal.id).then(check),
        ]);
        const result = resolveAuction(
          list.map((r) => r.id),
          (bids ?? []).map((b) => ({ userId: b.user_id, restaurantId: b.restaurant_id, amount: b.amount })),
          secureRng,
        );

        // 3) บันทึกผู้ชนะ + หักเหรียญคนที่บิดร้านที่ชนะ
        check(
          await db()
            .from("meals")
            .update({ winner_restaurant_id: result.winnerId, was_tie: result.wasTie })
            .eq("id", meal.id),
        );
        if (result.payments.length) {
          check(
            await db()
              .from("coin_ledger")
              .insert(
                result.payments.map((p) => ({
                  group_id: groupId,
                  user_id: p.userId,
                  meal_id: meal.id,
                  delta: -p.amount,
                  reason: "win",
                })),
              ),
          );
        }
        await bump(groupId, v);
        return;
      }

      case "cancel_meal": {
        const meal = requireMeal("adding", "bidding");
        // เจ้าของมื้อยกเลิกได้เสมอ / คนอื่นยกเลิกได้เมื่อมื้อนิ่งเกิน 10 นาที (กันมื้อค้าง)
        if (meal.created_by !== user.id) {
          const [rs, bs] = await Promise.all([
            db().from("restaurants").select("created_at").eq("meal_id", meal.id).then(check),
            db().from("bids").select("created_at").eq("meal_id", meal.id).then(check),
          ]);
          const last = lastActivityAt([
            meal.created_at,
            ...(rs ?? []).map((r) => r.created_at as string),
            ...(bs ?? []).map((b) => b.created_at as string),
          ]);
          if (!isStale(last, Date.now())) {
            throw new ApiError(403, `เฉพาะคนที่เริ่มมื้อ หรือรอให้มื้อไม่ขยับเกิน ${MEAL_STALE_MINUTES} นาที`);
          }
        }
        await claim(groupId, v);
        check(
          await db()
            .from("meals")
            .update({ status: "cancelled", closed_at: new Date().toISOString() })
            .eq("id", meal.id),
        );
        await bump(groupId, v);
        return;
      }

      default:
        throw new ApiError(400, "ไม่รู้จัก action นี้");
    }
  });
}
