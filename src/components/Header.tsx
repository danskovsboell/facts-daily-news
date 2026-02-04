'use client';

import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600 text-lg font-bold">
            F
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[#c5c5c5]">
              {APP_NAME}
            </h1>
            <p className="text-[11px] leading-tight text-zinc-500">
              AI-drevet fakta-check
            </p>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/settings"
            className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-[#c5c5c5]"
          >
            ⚙️ Indstillinger
          </Link>
        </nav>
      </div>
    </header>
  );
}
