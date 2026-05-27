import { CreateForm } from "@/components/CreateForm";
import { QRCard } from "@/components/QRCard";
import { apiServer, type QRInfo } from "@/lib/api";

export default async function DashboardPage() {
  const { data: list, status } = await apiServer<QRInfo[]>("/api/qr/list");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Create</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Type a URL — the QR previews instantly. Submit when ready.
        </p>
        <div className="mt-4">
          <CreateForm />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Your QRs</h2>
          {list && (
            <span className="text-sm text-zinc-500">{list.length} active</span>
          )}
        </div>
        {!list ? (
          <p className="mt-4 text-sm text-red-600">Failed to load (HTTP {status}).</p>
        ) : list.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No QRs yet — create one above.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {list.map((qr) => (
              <li key={qr.token}>
                <QRCard qr={qr} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
