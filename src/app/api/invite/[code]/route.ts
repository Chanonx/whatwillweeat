import { requireUser } from "@/lib/auth";
import { invitePreview, joinByInvite } from "@/lib/group-service";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/invite/:code → { name, memberCount }   (ดูก่อนกดเข้า)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handle(() => invitePreview(code));
}

// POST /api/invite/:code → { id }   (เข้าร่วมกลุ่ม)
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handle(async () => joinByInvite(await requireUser(), code));
}
