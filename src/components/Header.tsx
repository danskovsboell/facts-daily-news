'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { APP_NAME } from '@/lib/constants';
import { useAuth } from '@/components/AuthProvider';

export default function Header() {
  const { user, displayName, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
  };

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
          {loading ? (
            // Loading skeleton
            <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-800" />
          ) : user ? (
            // Logged in: user menu
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-[#c5c5c5]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-600/20 text-xs font-medium text-accent-400">
                  {(displayName || 'U')[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline">{displayName || 'Bruger'}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 animate-fade-in rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-[#c5c5c5]"
                  >
                    ⚙️ Indstillinger
                  </Link>
                  <div className="my-1 border-t border-zinc-800" />
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
                  >
                    🚪 Log ud
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Not logged in: login button
            <Link
              href="/auth/login"
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700"
            >
              Log ind
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
