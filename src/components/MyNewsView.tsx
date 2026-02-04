'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useArticles } from '@/hooks/useArticles';
import { Article, Category } from '@/lib/types';
import { DEFAULT_INTERESTS } from '@/lib/constants';
import ArticleCard from './ArticleCard';

/** Check if an article has any interest_tags that match user interests */
function hasMatchingInterest(article: Article, interests: string[]): boolean {
  const tags = (article.interest_tags || []).map((t) => t.toLowerCase());
  if (tags.length === 0) return false;

  return interests.some((interest) => {
    const interestLower = interest.toLowerCase();
    return tags.some(
      (tag) =>
        tag === interestLower ||
        tag.includes(interestLower) ||
        interestLower.includes(tag)
    );
  });
}

const SECTIONS: { category: Category; label: string; emoji: string }[] = [
  { category: 'danmark', label: 'Danmark', emoji: '🇩🇰' },
  { category: 'europa', label: 'Europa', emoji: '🇪🇺' },
  { category: 'verden', label: 'Verden', emoji: '🌍' },
];

export default function MyNewsView() {
  const [interests, setInterests] = useState<string[]>(DEFAULT_INTERESTS);

  const {
    articles,
    loading,
    error,
    refresh,
    loadMore,
    hasMore,
    lastUpdated,
  } = useArticles({
    autoRefresh: true,
    refreshInterval: 300000,
  });

  // Load user interests from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('fdn-interests');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setInterests(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Filter to interest-matching articles and group by region
  const grouped = useMemo(() => {
    const interestArticles = articles.filter((a) =>
      hasMatchingInterest(a, interests)
    );
    const byDate = (a: Article, b: Article) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    return SECTIONS.map((section) => ({
      ...section,
      articles: interestArticles
        .filter((a) => a.category === section.category)
        .sort(byDate),
    }));
  }, [articles, interests]);

  const totalMatching = grouped.reduce(
    (sum, s) => sum + s.articles.length,
    0
  );

  return (
    <div>
      {/* Interest tags display */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-600">Dine interesser:</span>
        {interests.map((interest) => (
          <span
            key={interest}
            className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400"
          >
            {interest}
          </span>
        ))}
        <Link
          href="/settings"
          className="ml-1 text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          Rediger →
        </Link>
      </div>

      {/* Status bar */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600">
            {loading
              ? 'Henter artikler...'
              : `${totalMatching} artikler matcher dine interesser`}
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

      {/* Error */}
      {error && error !== 'supabase_not_configured' && (
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

      {/* Loading */}
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
      {!loading && totalMatching === 0 && !error && (
        <div className="mt-12 text-center">
          <p className="text-lg text-zinc-500">
            ⭐ Ingen nyheder matcher dine interesser endnu
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Tjek dine interesser under{' '}
            <Link
              href="/settings"
              className="text-blue-500 hover:text-blue-400"
            >
              ⚙️ Indstillinger
            </Link>
            , eller vent på nye artikler.
          </p>
        </div>
      )}

      {/* Grouped sections */}
      {!loading && totalMatching > 0 && (
        <div className="mt-4 space-y-8">
          {grouped.map((section) => {
            if (section.articles.length === 0) return null;
            return (
              <div key={section.category}>
                <div className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <span className="text-lg">{section.emoji}</span>
                  <h2 className="text-lg font-semibold text-zinc-200">
                    {section.label}
                  </h2>
                  <span className="text-sm font-normal text-zinc-600">
                    ({section.articles.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {section.articles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          className="mt-6 w-full rounded-xl border border-zinc-800 bg-zinc-900/30 py-3 text-sm text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-300"
        >
          Indlæs flere artikler
        </button>
      )}
    </div>
  );
}
