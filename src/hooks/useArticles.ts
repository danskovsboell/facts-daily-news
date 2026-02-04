'use client';

import { useState, useEffect, useCallback } from 'react';
import { Article, Category, SubCategory } from '@/lib/types';

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

export function useArticles({
  category,
  subCategory,
  autoRefresh = false,
  refreshInterval = 300000,
}: UseArticlesOptions = {}): UseArticlesReturn {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const limit = 20;

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
        setArticles(prev => [...prev, ...(data.articles || [])]);
      } else {
        setArticles(data.articles || []);
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
