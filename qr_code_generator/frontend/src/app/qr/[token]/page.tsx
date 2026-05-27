import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { CopyButton } from "@/components/CopyButton";
import { QRDetailActions } from "@/components/QRDetailActions";
import { apiServer, imageUrlFor, shortUrlFor, type Analytics, type QRInfo } from "@/lib/api";

export default async function QRDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [info, analytics] = await Promise.all([
    apiServer<QRInfo>(`/api/qr/${token}`),
    apiServer<Analytics>(`/api/qr/${token}/analytics`),
  ]);

  if (info.status === 404 || !info.data) notFound();
  if (info.data === null) {
    return <p className="text-red-600">Failed to load (HTTP {info.status}).</p>;
  }

  const qr = info.data;
  const stats = analytics.data;
  const shortUrl = shortUrlFor(qr.token);
  const expired = qr.expires_at ? new Date(qr.expires_at) < new Date() : false;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8">
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrlFor(qr.token)}
            alt={`QR for ${qr.token}`}
            width={224}
            height={224}
            className="bg-white rounded"
          />
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all flex-1">
                {shortUrl}
              </code>
              <CopyButton value={shortUrl} />
            </div>
            <a
              href={shortUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Open in new tab →
            </a>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-xl font-semibold">Manage</h1>
            {expired && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Expired
              </span>
            )}
          </div>
          <QRDetailActions qr={qr} />
          <p className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
            Created {format(new Date(qr.created_at), "MMM d, yyyy HH:mm")} · Updated{" "}
            {format(new Date(qr.updated_at), "MMM d, yyyy HH:mm")}
          </p>
        </div>
      </div>

      <section className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold">Analytics</h2>
          {stats && (
            <span className="text-2xl font-semibold tabular-nums">
              {stats.total_scans}
              <span className="ml-1 text-sm text-zinc-500 font-normal">total scans</span>
            </span>
          )}
        </div>
        {stats ? (
          <AnalyticsChart data={stats.scans_by_day} />
        ) : (
          <p className="text-sm text-zinc-500">Analytics unavailable.</p>
        )}
      </section>
    </div>
  );
}
