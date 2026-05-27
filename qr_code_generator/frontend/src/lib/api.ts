import { auth } from "@clerk/nextjs/server";

export type QRInfo = {
  token: string;
  original_url: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_deleted: boolean;
};

export type CreateResponse = {
  token: string;
  short_url: string;
  qr_code_url: string;
  original_url: string;
};

export type Analytics = {
  token: string;
  total_scans: number;
  scans_by_day: { date: string; count: number }[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE ?? API_BASE;

async function authHeaders(): Promise<HeadersInit> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiServer<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T | null; status: number }> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...(init.headers ?? {}),
  };
  const res = await fetch(`${INTERNAL_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) return { data: null, status: res.status };
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return { data: (await res.json()) as T, status: res.status };
  }
  return { data: null, status: res.status };
}

export function imageUrlFor(token: string): string {
  return `${API_BASE}/api/qr/${token}/image`;
}

export function shortUrlFor(token: string): string {
  return `${API_BASE}/r/${token}`;
}
