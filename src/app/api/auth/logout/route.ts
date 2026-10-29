import { logout } from "@/lib/auth";
import { handle } from "@/lib/http";

export async function POST() {
  return handle(async () => {
    await logout();
    return { ok: true };
  });
}
