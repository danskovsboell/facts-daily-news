import { APP_NAME } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-6">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-xs font-bold">
              F
            </div>
            <span className="text-sm text-zinc-500">{APP_NAME}</span>
          </div>
          <p className="text-xs text-zinc-600">
            Fakta-check drevet af Grok (xAI) · AI-genererede artikler ·{' '}
            {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
