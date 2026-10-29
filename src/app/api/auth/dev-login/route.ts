import { devLogin } from "@/lib/auth";
import { handle, readJson } from "@/lib/http";

// ใช้ได้เฉพาะตอนพัฒนาในเครื่อง (DEV_FAKE_AUTH=1) — production ตอบ 404
export async function POST(req: Request) {
  return handle(async () => devLogin(String((await readJson(req)).name ?? "")));
}
