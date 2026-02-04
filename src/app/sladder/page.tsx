'use client';

import NewsCard from '@/components/NewsCard';
import { useNews } from '@/hooks/useNews';

export default function SladderPage() {
  const { news, loading, error, refresh, lastUpdated } = useNews({
    category: 'sladder',
    autoRefresh: true,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#c5c5c5]">🗣️ Sludder & Sladder</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Kultur, underholdning og det lidt lettere stof
        </p>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">
          {loading ? 'Henter nyheder...' : `${news.length} artikler`}
        </span>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-zinc-700">
              {lastUpdated.toLocaleTimeString('da-DK')}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
          >
            🔄 Opdater
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-800/30 bg-red-900/10 p-4">
          <p className="text-sm text-red-400">⚠️ {error}</p>
        </div>
      )}

      {loading && news.length === 0 && (
        <div className="mt-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="h-5 w-3/4 rounded bg-zinc-800" />
              <div className="mt-3 h-4 w-full rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {news.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
