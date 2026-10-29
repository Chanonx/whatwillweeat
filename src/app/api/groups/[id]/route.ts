import { requireUser } from "@/lib/auth";
import { getGroupState } from "@/lib/group-service";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/groups/:id → GroupState (เฉพาะสมาชิก)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => getGroupState(await requireUser(), id));
}
