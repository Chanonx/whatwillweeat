// ใช้เฉพาะตอนเทส: สร้าง JWT (HS256) ให้ role ที่ระบุ — แทน key ที่ Supabase ออกให้
import { createHmac } from "node:crypto";

const [secret, role] = process.argv.slice(2);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64({ role, iss: "test", exp: 4102444800 });
const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
console.log(`${head}.${body}.${sig}`);
