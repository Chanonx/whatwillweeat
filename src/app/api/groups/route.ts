import { requireUser } from "@/lib/auth";
import { createGroup } from "@/lib/group-service";
import { handle, readJson } from "@/lib/http";

// POST /api/groups { name } → { id }
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    return createGroup(user, body.name);
  });
}
