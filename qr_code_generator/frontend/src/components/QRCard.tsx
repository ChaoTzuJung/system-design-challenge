import Link from "next/link";
import { format } from "date-fns";
import type { QRInfo } from "@/lib/api";
import { imageUrlFor, shortUrlFor } from "@/lib/api";

export function QRCard({ qr }: { qr: QRInfo }) {
  const expired = qr.expires_at ? new Date(qr.expires_at) < new Date() : false;
  return (
    <Link
      href={`/qr/${qr.token}`}
      className="group flex gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition-colors"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrlFor(qr.token)}
        alt={`QR for ${qr.token}`}
        width={72}
        height={72}
        className="rounded bg-white shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
            /r/{qr.token}
          </code>
          {expired && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Expired
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate mt-1">
          {qr.original_url}
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Created {format(new Date(qr.created_at), "MMM d, yyyy HH:mm")}
          {qr.expires_at && (
            <>
              {" · Expires "}
              {format(new Date(qr.expires_at), "MMM d, yyyy HH:mm")}
            </>
          )}
        </p>
      </div>
      <span className="text-zinc-400 group-hover:text-emerald-500 self-center">→</span>
    </Link>
  );
}

QRCard.Short = function QRCardShort({ token }: { token: string }) {
  return <code className="font-mono text-sm">{shortUrlFor(token)}</code>;
};
