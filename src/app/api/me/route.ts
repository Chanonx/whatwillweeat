import { getCurrentUser } from "@/lib/auth";
import { listMyGroups } from "@/lib/group-service";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/me → { user, groups } (ยังไม่ login → user = null)
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return { user, groups: user ? await listMyGroups(user) : [] };
  });
}
