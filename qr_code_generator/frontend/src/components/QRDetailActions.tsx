"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQRAction, updateQRAction } from "@/lib/actions";
import type { QRInfo } from "@/lib/api";
import { DateTimePicker } from "./DateTimePicker";

export function QRDetailActions({ qr }: { qr: QRInfo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingUrl, setEditingUrl] = useState(false);
  const [url, setUrl] = useState(qr.original_url);
  const [editingExp, setEditingExp] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(
    qr.expires_at ? new Date(qr.expires_at) : null,
  );
  const [error, setError] = useState<string | null>(null);

  function saveUrl() {
    setError(null);
    startTransition(async () => {
      const res = await updateQRAction(qr.token, { url });
      if (!res.ok) setError(parseError(res.error, res.status));
      else setEditingUrl(false);
    });
  }

  function saveExpiration() {
    setError(null);
    startTransition(async () => {
      const res = await updateQRAction(qr.token, {
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      });
      if (!res.ok) setError(parseError(res.error, res.status));
      else setEditingExp(false);
    });
  }

  function onDelete() {
    if (!confirm("Delete this QR? Scans will return 410 Gone.")) return;
    startTransition(async () => {
      const res = await deleteQRAction(qr.token);
      if (!res.ok) setError(parseError(res.error, res.status));
      else router.push("/dashboard");
    });
  }

  return (
    <div className="space-y-4">
      <Field label="Target URL">
        {editingUrl ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
            />
            <button
              onClick={saveUrl}
              disabled={pending}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingUrl(false);
                setUrl(qr.original_url);
              }}
              className="px-3 py-1.5 rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm break-all">{qr.original_url}</span>
            <button
              onClick={() => setEditingUrl(true)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Edit
            </button>
          </div>
        )}
      </Field>

      <Field label="Expires at">
        {editingExp ? (
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <DateTimePicker
                value={expiresAt}
                onChange={setExpiresAt}
                placeholder="Never expires"
              />
            </div>
            <button
              onClick={saveExpiration}
              disabled={pending}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingExp(false);
                setExpiresAt(qr.expires_at ? new Date(qr.expires_at) : null);
              }}
              className="px-3 py-1.5 rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {qr.expires_at ? new Date(qr.expires_at).toLocaleString() : "Never"}
            </span>
            <button
              onClick={() => setEditingExp(true)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Edit
            </button>
          </div>
        )}
      </Field>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onDelete}
          disabled={pending}
          className="px-3 py-1.5 rounded-md text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          Delete this QR
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function parseError(raw: string, status: number): string {
  if (status === 422) return "Invalid URL — check format and try again.";
  if (status === 404) return "Not found.";
  if (status === 401) return "Sign in required.";
  return `Error ${status}`;
}
