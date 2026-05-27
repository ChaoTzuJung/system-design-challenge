"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE ?? API_BASE;

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();
  return fetch(`${INTERNAL_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export async function createQRAction(input: {
  url: string;
  expires_at: string | null;
}): Promise<ActionResult<{ token: string; short_url: string; qr_code_url: string }>> {
  const res = await authedFetch("/api/qr/create", {
    method: "POST",
    body: JSON.stringify({
      url: input.url,
      expires_at: input.expires_at || null,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return { ok: false, error: detail || res.statusText, status: res.status };
  }
  const data = await res.json();
  revalidatePath("/dashboard");
  return { ok: true, data };
}

export async function updateQRAction(
  token: string,
  patch: { url?: string; expires_at?: string | null },
): Promise<ActionResult> {
  const res = await authedFetch(`/api/qr/${token}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    return { ok: false, error: await res.text(), status: res.status };
  }
  revalidatePath(`/qr/${token}`);
  revalidatePath("/dashboard");
  return { ok: true, data: await res.json() };
}

export async function deleteQRAction(token: string): Promise<ActionResult> {
  const res = await authedFetch(`/api/qr/${token}`, { method: "DELETE" });
  if (!res.ok) {
    return { ok: false, error: await res.text(), status: res.status };
  }
  revalidatePath("/dashboard");
  return { ok: true, data: null };
}
