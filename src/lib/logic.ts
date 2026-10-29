/**
 * Pure game logic — ไม่มี database, ไม่มี network
 * แยกไว้ตรงนี้เพื่อให้เขียน unit test ได้ง่าย (ดู logic.test.ts)
 */

export type Rng = () => number; // คืนค่า 0 <= x < 1 (เหมือน Math.random)

// ---------------------------------------------------------- กติกาเหรียญ
export const COINS = {
  START: 100, // เข้ากลุ่มครั้งแรกได้
  MEAL_BONUS: 20, // ได้เพิ่มทุกครั้งที่เริ่มมื้อใหม่
  CAP: 200, // เก็บสะสมได้ไม่เกิน
} as const;

/** โบนัสต่อมื้อ แต่ไม่ให้เกินเพดาน: ยอด 190 → ได้แค่ 10 */
export function mealBonus(balance: number): number {
  return Math.max(0, Math.min(COINS.MEAL_BONUS, COINS.CAP - balance));
}

// ---------------------------------------------------------------- utils

const INVITE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // ตัด 0/o/1/l/i ที่สับสนง่าย

/** รหัสในลิงก์เชิญ เช่น "k7m2xq9p" (31^8 ≈ 850,000 ล้านแบบ เดาไม่ได้) */
export function generateInviteCode(rng: Rng = Math.random, length = 8): string {
  let s = "";
  for (let i = 0; i < length; i++) s += INVITE_ALPHABET[Math.floor(rng() * INVITE_ALPHABET.length)];
  return s;
}

/** ทำชื่อร้านให้เป็นรูปแบบเดียวกัน เพื่อกันร้านซ้ำ: " Mo  MO Mo " → "mo mo mo" */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** สุ่มเลือก 1 ตัวจาก array */
export function pickRandom<T>(items: T[], rng: Rng = Math.random): T {
  if (items.length === 0) throw new Error("pickRandom: empty list");
  return items[Math.floor(rng() * items.length)];
}

// -------------------------------------------------------------- Auction

export interface Bid {
  userId: string;
  restaurantId: string;
  amount: number;
}

/**
 * ประมูลแบบปิดซอง
 *   1. รวมเหรียญที่บิดให้แต่ละร้าน → ร้านที่ยอดรวมสูงสุดชนะ
 *   2. เสมอ → สุ่มจากร้านที่เสมอกัน
 *   3. คนที่บิดร้านที่ชนะ → จ่ายเหรียญตามที่บิด | คนที่บิดร้านอื่น → ไม่เสียอะไร
 */
export function resolveAuction(restaurantIds: string[], bids: Bid[], rng: Rng = Math.random) {
  if (restaurantIds.length === 0) throw new Error("ไม่มีร้านให้ประมูล");

  const totals: Record<string, number> = {};
  for (const id of restaurantIds) totals[id] = 0;
  for (const b of bids) {
    if (b.restaurantId in totals) totals[b.restaurantId] += b.amount;
  }

  const max = Math.max(...Object.values(totals));
  const tied = restaurantIds.filter((id) => totals[id] === max);
  const winnerId = tied.length === 1 ? tied[0] : pickRandom(tied, rng);

  const payments = bids
    .filter((b) => b.restaurantId === winnerId && b.amount > 0)
    .map((b) => ({ userId: b.userId, amount: b.amount }));

  return { winnerId, totals, payments, wasTie: tied.length > 1 };
}
