import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Show } from "@clerk/nextjs";
import { StyledSignInButton } from "@/components/AuthButtons";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        Dynamic QR codes
        <span className="text-emerald-500">.</span>
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Create short URLs with QR images. Update targets without reprinting,
        track scans, and expire links on schedule.
      </p>

      <div className="mt-10 flex items-center justify-center gap-3">
        <Show when="signed-out">
          <StyledSignInButton className="px-5 py-2.5 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700">
            Sign in to create a QR
          </StyledSignInButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            Go to dashboard
          </Link>
        </Show>
      </div>

      <ul className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left text-sm">
        <Feature title="Live preview" body="See the QR update as you type — no round-trip." />
        <Feature title="Soft delete & expire" body="Retired links return 410 Gone, not 404." />
        <Feature title="Scan analytics" body="Per-day chart of scans, scoped to your account." />
      </ul>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-lg p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{body}</p>
    </li>
  );
}
