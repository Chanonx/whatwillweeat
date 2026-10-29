import { COINS } from "@/lib/logic";

/** อธิบายกติกาเหรียญแบบเข้าใจง่าย */
export function CoinRules() {
  const rules = [
    ["เข้ากลุ่มครั้งแรก", `+${COINS.START}`],
    ["ทุกครั้งที่เริ่มมื้อใหม่", `+${COINS.MEAL_BONUS}`],
    ["ร้านที่คุณบิดชนะ", "จ่ายตามที่บิด"],
    ["ร้านที่คุณบิดแพ้", "ไม่เสียเลย"],
  ];
  return (
    <div>
      <dl className="divide-y divide-line border-y border-line text-sm">
        {rules.map(([t, v]) => (
          <div key={t} className="flex items-center justify-between py-3">
            <dt className="text-muted">{t}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        เก็บได้สูงสุด {COINS.CAP} เหรียญ — ใครแพ้บ่อยจะมีเหรียญสะสมมากขึ้น รอบหน้าจึงมีโอกาสได้เลือกร้าน
      </p>
    </div>
  );
}
