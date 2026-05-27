import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { StyledSignInButton, StyledSignUpButton } from "@/components/AuthButtons";

export function Header() {
  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          QR<span className="text-emerald-500">.</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
            >
              Dashboard
            </Link>
            <UserButton />
          </Show>
          <Show when="signed-out">
            <StyledSignInButton className="px-3 py-1.5 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900">
              Sign in
            </StyledSignInButton>
            <StyledSignUpButton className="px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90">
              Sign up
            </StyledSignUpButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
