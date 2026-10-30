/**
 * Integration tests: ยิง API จริงของแอป (ต้องมี dev server + database รันอยู่)
 *
 * รันในเครื่อง:  npm run test:api      (ดู scripts/test-stack.sh)
 * รันใน CI:     .github/workflows/ci.yml
 *
 * ต้องมี env: APP_URL (default http://localhost:3000),
 *             NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ใช้ย้อนเวลาในเทสมื้อค้าง)
 * ฝั่งแอปต้องเปิด DEV_FAKE_AUTH=1 เพื่อ login ด้วยชื่อได้
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const DB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const run = randomUUID().slice(0, 6); // ชื่อไม่ซ้ำกันในแต่ละรอบที่รันเทส

// ------------------------------------------------------------------ helpers

async function login(name) {
  const res = await fetch(`${APP}/api/auth/dev-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `${name}-${run}` }),
  });
  assert.equal(res.status, 200, `dev-login failed: ${await res.text()}`);
  return res.headers.get("set-cookie").split(";")[0];
}

async function call(cookie, method, path, body) {
  const res = await fetch(APP + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function ok(cookie, method, path, body) {
  const r = await call(cookie, method, path, body);
  assert.ok(r.status < 300, `${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

const act = (cookie, groupId, action) => call(cookie, "POST", `/api/groups/${groupId}/action`, action);
const actOk = (cookie, groupId, action) => ok(cookie, "POST", `/api/groups/${groupId}/action`, action);
const state = (cookie, groupId) => ok(cookie, "GET", `/api/groups/${groupId}`);

/** ตั้งกลุ่มพร้อมสมาชิก: คนแรก = คนสร้างกลุ่ม */
async function setupGroup(...names) {
  const cookies = await Promise.all(names.map(login));
  const { id } = await ok(cookies[0], "POST", "/api/groups", { name: `test-${run}` });
  const s = await state(cookies[0], id);
  for (const c of cookies.slice(1)) await ok(c, "POST", `/api/invite/${s.group.inviteCode}`);
  return { id, cookies, inviteCode: s.group.inviteCode };
}

/** เริ่มมื้อ + ใส่ร้าน + เข้าขั้นบิด → คืน id ร้านตามชื่อ */
async function mealInBidding(groupId, owner, restaurants) {
  await actOk(owner, groupId, { type: "start_meal" });
  for (const name of restaurants) await actOk(owner, groupId, { type: "add_restaurant", name });
  await actOk(owner, groupId, { type: "start_bidding" });
  const s = await state(owner, groupId);
  return { mealId: s.meal.id, ids: Object.fromEntries(s.meal.restaurants.map((r) => [r.name, r.id])) };
}

/** อ่าน/แก้ database ตรง ๆ ด้วย service key (ใช้เฉพาะในเทส) */
async function rest(method, path, body) {
  const res = await fetch(`${DB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: DB_KEY,
      authorization: `Bearer ${DB_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  assert.ok(res.ok, `${method} ${path} → ${res.status} ${text}`);
  return JSON.parse(text);
}

// -------------------------------------------------------------------- tests

describe("auth + membership", () => {
  it("ยังไม่ login → 401, ไม่ใช่สมาชิก → 404", async () => {
    const r1 = await call("", "GET", "/api/groups/00000000-0000-4000-a000-000000000000");
    assert.equal(r1.status, 401);
    const { id } = await setupGroup("owner");
    const outsider = await login("outsider");
    assert.equal((await call(outsider, "GET", `/api/groups/${id}`)).status, 404);
  });

  it("เข้ากลุ่มด้วยลิงก์เชิญซ้ำได้ (idempotent) และได้ 100 เหรียญครั้งเดียว", async () => {
    const { id, cookies, inviteCode } = await setupGroup("a", "b");
    await ok(cookies[1], "POST", `/api/invite/${inviteCode}`);
    const s = await state(cookies[0], id);
    assert.deepEqual(s.members.map((m) => m.coins), [100, 100]);
  });
});

describe("restaurants", () => {
  it("หลายคนเพิ่มร้านพร้อมกันได้ครบ และร้านซ้ำ (normalize แล้ว) ถูกปฏิเสธ", async () => {
    const { id, cookies } = await setupGroup("a", "b", "c", "d");
    await actOk(cookies[0], id, { type: "start_meal" });
    const names = ["ชาบู", "หมูกระทะ", "Sushi", "ส้มตำ"];
    await Promise.all(cookies.map((c, i) => actOk(c, id, { type: "add_restaurant", name: names[i] })));
    assert.equal((await state(cookies[0], id)).meal.restaurants.length, 4);
    assert.equal((await act(cookies[1], id, { type: "add_restaurant", name: "  sushi " })).status, 409);
  });
});

describe("owner permissions", () => {
  it("เฉพาะเจ้าของมื้อที่ไปขั้นถัดไป / เปิดผล / ยกเลิกได้", async () => {
    const { id, cookies } = await setupGroup("owner", "member");
    const [owner, member] = cookies;
    await actOk(owner, id, { type: "start_meal" });
    await actOk(owner, id, { type: "add_restaurant", name: "A" });
    await actOk(owner, id, { type: "add_restaurant", name: "B" });
    assert.equal((await act(member, id, { type: "start_bidding" })).status, 403);
    assert.equal((await act(member, id, { type: "cancel_meal" })).status, 403);
    await actOk(owner, id, { type: "start_bidding" });
    assert.equal((await act(member, id, { type: "reveal" })).status, 403);
  });
});

describe("bidding", () => {
  it("บิดเกินเหรียญที่มี → 400 และยอดบิดของคนอื่นถูกซ่อนจนเปิดผล", async () => {
    const { id, cookies } = await setupGroup("a", "b");
    const { ids } = await mealInBidding(id, cookies[0], ["A", "B"]);
    assert.equal((await act(cookies[1], id, { type: "place_bid", restaurantId: ids.A, amount: 121 })).status, 400);
    await actOk(cookies[0], id, { type: "place_bid", restaurantId: ids.A, amount: 30 });
    await actOk(cookies[1], id, { type: "place_bid", restaurantId: ids.B, amount: 10 });
    const s = await state(cookies[1], id);
    assert.equal(s.meal.result, null);
    assert.deepEqual(s.meal.myBid.amount, 10);
    assert.equal(s.meal.bidders.length, 2);
  });

  it("บิดซ้ำ = แก้บิดเดิม (ไม่ใช่สองบิด)", async () => {
    const { id, cookies } = await setupGroup("a", "b");
    const { ids } = await mealInBidding(id, cookies[0], ["A", "B"]);
    await actOk(cookies[1], id, { type: "place_bid", restaurantId: ids.A, amount: 10 });
    await actOk(cookies[1], id, { type: "place_bid", restaurantId: ids.B, amount: 40 });
    await actOk(cookies[0], id, { type: "reveal" });
    const s = await state(cookies[0], id);
    assert.equal(s.meal.result.bids.length, 1);
    assert.equal(s.meal.result.bids[0].amount, 40);
  });

  it("เปิดผลซ้ำพร้อมกัน → หักเหรียญครั้งเดียว และเฉพาะคนที่บิดร้านที่ชนะ", async () => {
    const { id, cookies } = await setupGroup("a", "b", "c");
    const { ids } = await mealInBidding(id, cookies[0], ["A", "B"]);
    await actOk(cookies[0], id, { type: "place_bid", restaurantId: ids.A, amount: 50 });
    await actOk(cookies[1], id, { type: "place_bid", restaurantId: ids.B, amount: 40 });
    await actOk(cookies[2], id, { type: "place_bid", restaurantId: ids.B, amount: 30 });
    await Promise.all([
      act(cookies[0], id, { type: "reveal" }),
      act(cookies[0], id, { type: "reveal" }),
      act(cookies[0], id, { type: "reveal" }),
    ]);
    const s = await state(cookies[0], id);
    assert.equal(s.meal.result.winnerId, ids.B); // 70 > 50
    // ทุกคนได้ +20 ตอนเริ่มมื้อ (120) → คนบิด B จ่ายตามที่บิด, คนบิด A ไม่เสีย
    assert.deepEqual(s.members.map((m) => m.coins), [120, 80, 90]);
  });

  it("เสมอกัน → ผู้ชนะเป็นหนึ่งในร้านที่เสมอ และ wasTie = true", async () => {
    const { id, cookies } = await setupGroup("a", "b");
    const { ids } = await mealInBidding(id, cookies[0], ["A", "B", "C"]);
    await actOk(cookies[0], id, { type: "place_bid", restaurantId: ids.A, amount: 25 });
    await actOk(cookies[1], id, { type: "place_bid", restaurantId: ids.B, amount: 25 });
    await actOk(cookies[0], id, { type: "reveal" });
    const s = await state(cookies[1], id);
    assert.ok([ids.A, ids.B].includes(s.meal.result.winnerId));
    assert.equal(s.meal.result.wasTie, true);
  });

  it("บิดชนกับเปิดผล (race) → บิดที่บันทึกได้ถูกนับครบทุกบิด, บิดที่มาช้าได้ 409", async () => {
    const { id, cookies } = await setupGroup("o", "p1", "p2", "p3", "p4", "p5");
    for (let round = 0; round < 3; round++) {
      const { mealId, ids } = await mealInBidding(id, cookies[0], [`A${round}`, `B${round}`]);
      const target = round % 2 ? ids[`A${round}`] : ids[`B${round}`];
      const results = await Promise.all([
        ...cookies.slice(1).map((c) => act(c, id, { type: "place_bid", restaurantId: target, amount: 5 })),
        act(cookies[0], id, { type: "reveal" }),
      ]);
      for (const r of results) assert.ok([200, 409].includes(r.status), JSON.stringify(r));

      // invariant: ยอดที่หักจาก ledger = ผลรวมบิดของร้านที่ชนะที่อยู่ใน DB ทุกบิด
      const [meal] = await rest("GET", `meals?id=eq.${mealId}&select=winner_restaurant_id,status`);
      const bids = await rest("GET", `bids?meal_id=eq.${mealId}&select=restaurant_id,amount`);
      const ledger = await rest("GET", `coin_ledger?meal_id=eq.${mealId}&reason=eq.win&select=delta`);
      const onWinner = bids.filter((b) => b.restaurant_id === meal.winner_restaurant_id);
      assert.equal(meal.status, "done");
      assert.equal(
        ledger.reduce((s, l) => s - l.delta, 0),
        onWinner.reduce((s, b) => s + b.amount, 0),
        `round ${round}: every stored bid on the winner must be charged`,
      );
    }
  });

  it("database ปฏิเสธการเขียนบิดลงมื้อที่เปิดผลแล้ว (trigger) แม้จะใช้ secret key", async () => {
    const { id, cookies } = await setupGroup("a", "b");
    const { mealId, ids } = await mealInBidding(id, cookies[0], ["A", "B"]);
    await actOk(cookies[0], id, { type: "reveal" });
    const [member] = await rest("GET", `group_members?group_id=eq.${id}&select=user_id&limit=1`);
    const res = await fetch(`${DB_URL}/rest/v1/bids`, {
      method: "POST",
      headers: { apikey: DB_KEY, authorization: `Bearer ${DB_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ meal_id: mealId, user_id: member.user_id, restaurant_id: ids.A, amount: 1 }),
    });
    assert.equal(res.ok, false);
    assert.match(await res.text(), /meal_not_bidding/);
  });
});

describe("stale meal", () => {
  it("มื้อนิ่งไม่ถึง 10 นาที คนอื่นยกเลิกไม่ได้ / เกิน 10 นาทีแล้วยกเลิกได้", async () => {
    const { id, cookies } = await setupGroup("owner", "member");
    const [owner, member] = cookies;
    await actOk(owner, id, { type: "start_meal" });
    await actOk(owner, id, { type: "add_restaurant", name: "A" });
    let s = await state(member, id);
    assert.equal(s.meal.staleCancelable, false);
    assert.equal((await act(member, id, { type: "cancel_meal" })).status, 403);

    // ย้อนเวลา: ให้ทุกความเคลื่อนไหวของมื้อนี้เกิดเมื่อ 11 นาทีก่อน
    const past = new Date(Date.now() - 11 * 60_000).toISOString();
    await rest("PATCH", `meals?id=eq.${s.meal.id}`, { created_at: past });
    await rest("PATCH", `restaurants?meal_id=eq.${s.meal.id}`, { created_at: past });

    s = await state(member, id);
    assert.equal(s.meal.staleCancelable, true);
    await actOk(member, id, { type: "cancel_meal" });
    assert.equal((await state(member, id)).meal, null);
  });
});
