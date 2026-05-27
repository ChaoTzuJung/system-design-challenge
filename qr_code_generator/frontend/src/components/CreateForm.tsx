"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQRAction } from "@/lib/actions";
import { QRPreview } from "./QRPreview";
import { DateTimePicker } from "./DateTimePicker";

export function CreateForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createQRAction({
        url,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      });
      if (!result.ok) {
        setError(parseError(result.error, result.status));
        return;
      }
      router.push(`/qr/${result.data.token}`);
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium mb-1.5">
            Long URL
          </label>
          <input
            id="url"
            type="url"
            required
            placeholder="https://example.com/very-long-link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="expiresAt" className="block text-sm font-medium mb-1.5">
            Expires at <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <DateTimePicker
            id="expiresAt"
            value={expiresAt}
            onChange={setExpiresAt}
            placeholder="Never expires"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={pending || !url}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Creating…" : "Create QR"}
        </button>
      </form>
      <div className="md:pl-6 md:border-l md:border-zinc-200 md:dark:border-zinc-800">
        <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
          Live preview
        </p>
        <QRPreview value={url} size={192} />
      </div>
    </div>
  );
}

function parseError(raw: string, status: number): string {
  if (status === 422) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.detail) {
        return Array.isArray(parsed.detail)
          ? parsed.detail.map((d: { msg?: string }) => d.msg ?? "Invalid").join(", ")
          : String(parsed.detail);
      }
    } catch {
      /* fall through */
    }
    return "Invalid URL";
  }
  if (status === 429) return "Too many requests. Try again in a minute.";
  if (status === 401) return "Sign in to create QR codes.";
  return `Error ${status}`;
}
