"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, HttpError } from "@/lib/client";
import { browserDb } from "@/lib/supabase-browser";
import type { GroupState } from "@/lib/types";

/**
 * โหลดข้อมูลกลุ่ม + อัปเดตแบบ real-time
 *
 * เหมือนกริ่งประตู
 * 1. ทุกจอฟัง Supabase Realtime ที่แถว group_signals ของกลุ่มนี้
 * 2. ใครทำอะไร server จะเพิ่ม version → กริ่งดัง
 * 3. ได้ยินกริ่ง → ไปดึงข้อมูลล่าสุดจาก API
 * สำรอง: ถ้า realtime ไม่ติด → ดึงเองทุก 3 วินาที (polling)
 */
export function useGroup(groupId: string) {
  const [state, setState] = useState<GroupState | null>(null);
  const [error, setError] = useState<HttpError | null>(null);
  const [live, setLive] = useState(false);
  const inflight = useRef(false);
  const queued = useRef(false);

  const refresh = useCallback(async () => {
    // กำลังโหลดอยู่ → จองรอบถัดไปไว้ 1 รอบ (ไม่ยิงซ้อน)
    if (inflight.current) {
      queued.current = true;
      return;
    }
    inflight.current = true;
    try {
      const next = await api.group(groupId);
      // กันข้อมูลเก่ามาทับข้อมูลใหม่
      setState((prev) => (prev && prev.group.version > next.group.version ? prev : next));
      setError(null);
    } catch (e) {
      setError(e instanceof HttpError ? e : new HttpError(0, "เชื่อมต่อไม่ได้"));
    } finally {
      inflight.current = false;
      if (queued.current) {
        queued.current = false;
        void refresh();
      }
    }
  }, [groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // realtime
  useEffect(() => {
    const sb = browserDb();
    if (!sb) return;
    const channel = sb
      .channel(`group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_signals", filter: `group_id=eq.${groupId}` },
        () => void refresh(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      void sb.removeChannel(channel);
    };
  }, [groupId, refresh]);

  // polling สำรอง: realtime ไม่ติด → ทุก 3 วิ | ติด → ทุก 30 วิ (กันพลาด)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, live ? 30_000 : 3_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [live, refresh]);

  return { state, error, live, refresh };
}
