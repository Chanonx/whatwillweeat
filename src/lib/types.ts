// รูปแบบข้อมูลที่ API ส่งให้หน้าเว็บ

export type MealStatus = "adding" | "bidding" | "done" | "cancelled";

export interface Me {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  myCoins: number;
  hasOpenMeal: boolean;
}

export interface Member {
  userId: string;
  name: string;
  avatarUrl: string | null;
  coins: number;
}

export interface Restaurant {
  id: string;
  name: string;
  addedBy: string;
}

export interface BidView {
  userId: string;
  restaurantId: string;
  amount: number;
}

export interface Meal {
  id: string;
  status: MealStatus;
  createdBy: string;
  createdAt: string;
  restaurants: Restaurant[];
  /** userId ของคนที่บิดแล้ว (ไม่บอกยอด) */
  bidders: string[];
  myBid: BidView | null;
  /** เวลาล่าสุดที่มื้อมีความเคลื่อนไหว (ISO) */
  lastActivityAt: string;
  /** true = มื้อนิ่งเกิน 10 นาที คนที่ไม่ใช่เจ้าของก็ยกเลิกได้ */
  staleCancelable: boolean;
  /** มีเฉพาะเมื่อ status = done */
  result: {
    winnerId: string;
    wasTie: boolean;
    bids: BidView[];
  } | null;
}

export interface HistoryItem {
  id: string;
  winnerName: string;
  createdAt: string;
}

export interface GroupState {
  meId: string;
  group: { id: string; name: string; inviteCode: string; version: number };
  members: Member[];
  /** มื้อที่ยังเปิดอยู่ หรือมื้อล่าสุดที่เพิ่งจบ (ไว้โชว์ผล) */
  meal: Meal | null;
  history: HistoryItem[];
}

export type Action =
  | { type: "start_meal" }
  | { type: "add_restaurant"; name: string }
  | { type: "remove_restaurant"; restaurantId: string }
  | { type: "start_bidding" }
  | { type: "place_bid"; restaurantId: string; amount: number }
  | { type: "reveal" }
  | { type: "cancel_meal" };

export const MAX_RESTAURANTS_PER_MEMBER = 3;
export const MAX_MEMBERS = 30;
