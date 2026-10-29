import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "./errors";

/** ห่อ route handler: แปลง ApiError → JSON { error } พร้อม status code ที่ถูกต้อง */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new ApiError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
