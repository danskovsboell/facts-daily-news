'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Article, Category, SubCategory } from '@/lib/types';
import { DEFAULT_INTERESTS } from '@/lib/constants';

interface UseArticlesOptions {
  category?: Category;
  subCategory?: SubCategory;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseArticlesReturn {
  articles: Article[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  lastUpdated: Date | null;
  count: number;
}

/** Check if an article has any interest_tags that match user interests */
function hasMatchingInterest(article: Article, interests: string[]): boolean {
  const tags = (article.interest_tags || []).map(t => t.toLowerCase());
  if (tags.length === 0) return false;

  return interests.some(interest => {
    const interestLower = interest.toLowerCase();
    return tags.some(tag => tag === interestLower || tag.includes(interestLower) || interestLower.includes(tag));
  });
}

/**
 * Sort articles: interest-tagged articles ALWAYS first, then the rest.
 * Within each group, sorted by created_at (newest first).
 */
function prioritizeArticles(articles: Article[], interests: string[]): Article[] {
  if (!interests.length) return articles;

  const matched: Article[] = [];
  const rest: Article[] = [];

  for (const article of articles) {
    if (hasMatchingInterest(article, interests)) {
      matched.push(article);
    } else {
      rest.push(article);
    }
  }

  // Sort each group by date (newest first)
  const byDate = (a: Article, b: Article) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  matched.sort(byDate);
  rest.sort(byDate);

  return [...matched, ...rest];
}

export function useArticles({
  category,
  subCategory,
  autoRefresh = false,
  refreshInterval = 300000,
}: UseArticlesOptions = {}): UseArticlesReturn {
  const [rawArticles, setRawArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const [interests, setInterests] = useState<string[]>(DEFAULT_INTERESTS);
  const limit = 20;

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

  // Prioritize articles by interests
  const articles = useMemo(
    () => prioritizeArticles(rawArticles, interests),
    [rawArticles, interests]
  );

  const fetchArticles = useCallback(async (loadingMore = false) => {
    try {
      if (!loadingMore) {
        setLoading(true);
        setOffset(0);
      }
      setError(null);

      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (subCategory) params.set('subCategory', subCategory);
      params.set('limit', String(limit));
      params.set('offset', String(loadingMore ? offset : 0));

      const response = await fetch(`/api/articles?${params}`);

      if (!response.ok) {
        // If Supabase not configured, fall back gracefully
        if (response.status === 503) {
          setError('supabase_not_configured');
          return;
        }
        throw new Error(`Failed to fetch articles: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (loadingMore) {
        setRawArticles(prev => [...prev, ...(data.articles || [])]);
      } else {
        setRawArticles(data.articles || []);
      }
      setHasMore(data.hasMore || false);
      setCount(data.count || 0);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl');
    } finally {
      setLoading(false);
    }
  }, [category, subCategory, offset]);

  const loadMore = useCallback(async () => {
    setOffset(prev => prev + limit);
    await fetchArticles(true);
  }, [fetchArticles]);

  useEffect(() => {
    fetchArticles();
  }, [category, subCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchArticles(), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchArticles]);

  return {
    articles,
    loading,
    error,
    refresh: () => fetchArticles(),
    loadMore,
    hasMore,
    lastUpdated,
    count,
  };
}
