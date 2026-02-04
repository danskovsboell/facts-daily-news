'use client';

import { useState, useMemo } from 'react';
import TabNavigation from '@/components/TabNavigation';
import ArticleCard from '@/components/ArticleCard';
import InterestFilter from '@/components/InterestFilter';
import MyNewsView from '@/components/MyNewsView';
import { useArticles } from '@/hooks/useArticles';
import { articleMatchesTag } from '@/lib/interest-utils';
import { Category, SubCategory, TabId } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dine-nyheder');
  const [activeSubTab, setActiveSubTab] = useState<SubCategory>('generelt');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const isMyNews = activeTab === 'dine-nyheder';

  // Only use Supabase articles — no RSS fallback
  const {
    articles: rawArticles,
    loading,
    error,
    refresh: refreshArticles,
    loadMore,
    hasMore,
    lastUpdated,
    count,
  } = useArticles({
    category: isMyNews ? undefined : (activeTab as Category),
    subCategory:
      !isMyNews && activeTab !== 'sladder' ? activeSubTab : undefined,
    autoRefresh: !isMyNews,
    refreshInterval: 300000,
  });

  // Apply tag filter on regular tabs
  const articles = useMemo(() => {
    if (!filterTag || isMyNews) return rawArticles;
    return rawArticles.filter((a) => articleMatchesTag(a, filterTag));
  }, [rawArticles, filterTag, isMyNews]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Navigation */}
      <TabNavigation
        activeTab={activeTab}
        activeSubTab={activeSubTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveSubTab('generelt');
          setFilterTag(null); // reset filter on tab switch
        }}
        onSubTabChange={(sub) => {
          setActiveSubTab(sub);
          setFilterTag(null); // reset filter on sub-tab switch
        }}
      />

      {/* "Dine Nyheder" tab — separate component */}
      {isMyNews && <MyNewsView />}

      {/* Regular category tabs */}
      {!isMyNews && (
        <>
          {/* Interest tag filter */}
          <InterestFilter activeTag={filterTag} onTagChange={setFilterTag} />

          {/* Status bar */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-600">
                {loading
                  ? 'Henter artikler...'
                  : filterTag
                    ? `${articles.length} af ${count} artikler (filtreret)`
                    : `${count} artikler`}
              </span>
              {lastUpdated && (
                <span className="text-[10px] text-zinc-700">
                  Opdateret: {lastUpdated.toLocaleTimeString('da-DK')}
                </span>
              )}
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
                ✨ AI-artikler
              </span>
            </div>
            <button
              onClick={refreshArticles}
              disabled={loading}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
            >
              🔄 Opdater
            </button>
          </div>

          {/* Error state */}
          {error && error !== 'supabase_not_configured' && (
            <div className="mt-4 rounded-xl border border-red-800/30 bg-red-900/10 p-4">
              <p className="text-sm text-red-400">⚠️ {error}</p>
              <button
                onClick={refreshArticles}
                className="mt-2 text-xs text-red-500 underline hover:text-red-400"
              >
                Prøv igen
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && articles.length === 0 && (
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

          {/* Empty state */}
          {!loading && articles.length === 0 && !error && (
            <div className="mt-12 text-center">
              {filterTag ? (
                <>
                  <p className="text-lg text-zinc-500">
                    🔍 Ingen artikler med #{filterTag}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Prøv at fjerne filteret for at se alle artikler.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg text-zinc-500">
                    📰 Ingen artikler endnu
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Nye artikler genereres automatisk. Tjek igen om lidt.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Articles feed */}
          {articles.length > 0 && (
            <div className="mt-4 space-y-3">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
              {hasMore && !filterTag && (
                <button
                  onClick={loadMore}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 py-3 text-sm text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-300"
                >
                  Indlæs flere artikler
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
