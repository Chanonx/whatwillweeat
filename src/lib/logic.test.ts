import { describe, expect, it } from "vitest";
import { COINS, generateInviteCode, mealBonus, normalizeName, resolveAuction } from "./logic";

describe("mealBonus", () => {
  it("ได้ +20 ตามปกติ", () => expect(mealBonus(100)).toBe(20));
  it("ไม่ให้เกินเพดาน 200", () => {
    expect(mealBonus(190)).toBe(10);
    expect(mealBonus(COINS.CAP)).toBe(0);
    expect(mealBonus(250)).toBe(0);
  });
});

describe("generateInviteCode", () => {
  it("ยาว 8 ตัว และไม่มีตัวที่สับสนง่าย", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[a-z2-9]{8}$/);
    expect(code).not.toMatch(/[01ilo]/);
  });
});

describe("normalizeName", () => {
  it("ตัดช่องว่างและทำเป็นตัวเล็ก", () => {
    expect(normalizeName("  Mo  MO   Mo ")).toBe("mo mo mo");
    expect(normalizeName("ส้มตำ ป้าแดง")).toBe("ส้มตำ ป้าแดง");
  });
});

describe("resolveAuction", () => {
  it("ร้านที่ยอดรวมสูงสุดชนะ และเฉพาะคนบิดร้านนั้นที่ต้องจ่าย", () => {
    const r = resolveAuction(
      ["a", "b"],
      [
        { userId: "u1", restaurantId: "a", amount: 30 },
        { userId: "u2", restaurantId: "a", amount: 30 },
        { userId: "u3", restaurantId: "b", amount: 50 },
      ],
    );
    expect(r.winnerId).toBe("a");
    expect(r.totals).toEqual({ a: 60, b: 50 });
    expect(r.payments).toEqual([
      { userId: "u1", amount: 30 },
      { userId: "u2", amount: 30 },
    ]);
    expect(r.wasTie).toBe(false);
  });

  it("เสมอกัน → สุ่มจากร้านที่เสมอเท่านั้น", () => {
    const bids = [
      { userId: "u1", restaurantId: "a", amount: 50 },
      { userId: "u2", restaurantId: "b", amount: 50 },
    ];
    expect(resolveAuction(["a", "b", "c"], bids, () => 0).winnerId).toBe("a");
    expect(resolveAuction(["a", "b", "c"], bids, () => 0.99).winnerId).toBe("b");
    expect(resolveAuction(["a", "b", "c"], bids, () => 0).wasTie).toBe(true);
  });

  it("ไม่มีใครบิดเลย → สุ่มจากทุกร้าน ไม่มีใครจ่าย", () => {
    const r = resolveAuction(["a", "b"], [], () => 0.6);
    expect(r.winnerId).toBe("b");
    expect(r.payments).toEqual([]);
  });

  it("บิด 0 ไม่ต้องจ่าย", () => {
    const r = resolveAuction(["a"], [{ userId: "u1", restaurantId: "a", amount: 0 }]);
    expect(r.payments).toEqual([]);
  });
});
