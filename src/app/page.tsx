'use client';

import { useState } from 'react';
import TabNavigation from '@/components/TabNavigation';
import NewsCard from '@/components/NewsCard';
import { useNews } from '@/hooks/useNews';
import { Category, SubCategory } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Category>('danmark');
  const [activeSubTab, setActiveSubTab] = useState<SubCategory>('generelt');

  const { news, loading, error, refresh, lastUpdated } = useNews({
    category: activeTab,
    subCategory: activeTab !== 'sladder' ? activeSubTab : undefined,
    autoRefresh: true,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Navigation */}
      <TabNavigation
        activeTab={activeTab}
        activeSubTab={activeSubTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveSubTab('generelt');
        }}
        onSubTabChange={setActiveSubTab}
      />

      {/* Status bar */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600">
            {loading ? 'Henter nyheder...' : `${news.length} nyheder`}
          </span>
          {lastUpdated && (
            <span className="text-[10px] text-zinc-700">
              Opdateret: {lastUpdated.toLocaleTimeString('da-DK')}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
        >
          🔄 Opdater
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-800/30 bg-red-900/10 p-4">
          <p className="text-sm text-red-400">⚠️ {error}</p>
          <button
            onClick={refresh}
            className="mt-2 text-xs text-red-500 underline hover:text-red-400"
          >
            Prøv igen
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && news.length === 0 && (
        <div className="mt-8 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 rounded bg-zinc-800" />
                <div className="h-5 w-16 rounded bg-zinc-800" />
              </div>
              <div className="mt-3 h-5 w-3/4 rounded bg-zinc-800" />
              <div className="mt-2 h-4 w-full rounded bg-zinc-800" />
              <div className="mt-1 h-4 w-2/3 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {/* News feed */}
      {!loading && news.length === 0 && !error && (
        <div className="mt-12 text-center">
          <p className="text-lg text-zinc-500">📰 Ingen nyheder fundet</p>
          <p className="mt-2 text-sm text-zinc-600">
            Prøv en anden kategori eller opdater
          </p>
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
