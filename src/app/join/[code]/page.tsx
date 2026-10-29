"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LoginButton } from "@/components/LoginButton";
import { JoinSkeleton } from "@/components/Skeletons";
import { Button, Coins, ErrorText } from "@/components/ui";
import { api } from "@/lib/client";
import { COINS } from "@/lib/logic";
import type { Me } from "@/lib/types";

/** หน้าลิงก์เชิญ: /join/<code> */
export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<{ name: string; memberCount: number } | null>(null);
  const [user, setUser] = useState<Me | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(() => {
    api.invite(code).then(setPreview).catch((e) => setError(e.message));
    api.me().then((d) => setUser(d.user)).catch(() => setUser(null));
  }, [code]);
  useEffect(load, [load]);

  async function join() {
    setJoining(true);
    try {
      const { id } = await api.join(code);
      router.replace(`/g/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setJoining(false);
    }
  }

  if (error && !preview) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-medium">{error}</p>
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          กลับหน้าแรก
        </Link>
      </main>
    );
  }
  if (!preview || user === undefined) return <JoinSkeleton />;

  return (
    <main className="animate-phase mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="mb-2 text-sm text-muted">คุณได้รับเชิญเข้ากลุ่ม</p>
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">{preview.name}</h1>
      <p className="mb-8 text-sm text-muted">สมาชิก {preview.memberCount} คน</p>

      <div className="mb-8 flex items-center justify-between border-y border-line py-4 text-sm">
        <span className="text-muted">เข้ากลุ่มแล้วได้รับ</span>
        <Coins value={COINS.START} />
      </div>

      {user ? (
        <Button onClick={join} loading={joining} className="w-full">
          เข้าร่วมกลุ่ม
        </Button>
      ) : (
        <LoginButton next={`/join/${code}`} onDone={load} />
      )}
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </main>
  );
}
