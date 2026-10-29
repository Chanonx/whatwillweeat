import { requireUser } from "@/lib/auth";
import { performAction } from "@/lib/group-service";
import { handle, readJson } from "@/lib/http";
import type { Action } from "@/lib/types";

// POST /api/groups/:id/action { type, ... } → { ok: true }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const user = await requireUser();
    const action = (await readJson(req)) as unknown as Action;
    await performAction(user, id, action);
    return { ok: true };
  });
}
