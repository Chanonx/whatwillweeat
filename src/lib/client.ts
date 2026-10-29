"use client";

import type { Action, GroupState, GroupSummary, Me } from "./types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new HttpError(0, "เชื่อมต่ออินเทอร์เน็ตไม่ได้");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, body.error ?? "เกิดข้อผิดพลาด");
  return body as T;
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body ?? {}),
});

export const api = {
  me: () => request<{ user: Me | null; groups: GroupSummary[] }>("/api/me"),
  createGroup: (name: string) => request<{ id: string }>("/api/groups", post({ name })),
  group: (id: string) => request<GroupState>(`/api/groups/${id}`),
  act: (id: string, action: Action) => request<{ ok: true }>(`/api/groups/${id}/action`, post(action)),
  invite: (code: string) => request<{ name: string; memberCount: number }>(`/api/invite/${code}`),
  join: (code: string) => request<{ id: string }>(`/api/invite/${code}`, post()),
  logout: () => request<{ ok: true }>("/api/auth/logout", post()),
  devLogin: (name: string) => request<Me>("/api/auth/dev-login", post({ name })),
};
