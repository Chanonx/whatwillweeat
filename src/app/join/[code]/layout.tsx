import type { Metadata } from "next";
import { invitePreview } from "@/lib/group-service";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, socialMeta } from "@/lib/site";

/**
 * การ์ด preview ตอนส่งลิงก์เชิญใน LINE: ขึ้นชื่อกลุ่ม + จำนวนคน
 * (หน้าเชิญเป็น client component จึงตั้ง metadata ที่ layout ฝั่ง server แทน)
 */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  try {
    const g = await invitePreview(code);
    return socialMeta(
      `ชวนเข้ากลุ่ม "${g.name}" — กินอะไรดี?`,
      `${g.memberCount} คนรอเลือกร้านด้วยกันอยู่ กดเพื่อเข้ากลุ่มแล้วรับ 100 เหรียญ`,
    );
  } catch {
    return socialMeta(DEFAULT_TITLE, DEFAULT_DESCRIPTION);
  }
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
