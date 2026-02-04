'use client';

import { useState, useEffect, useCallback } from 'react';
import { NewsItem, Category, SubCategory } from '@/lib/types';

interface UseNewsOptions {
  category?: Category;
  subCategory?: SubCategory;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

interface UseNewsReturn {
  news: NewsItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export function useNews({
  category,
  subCategory,
  autoRefresh = false,
  refreshInterval = 300000, // 5 min default
}: UseNewsOptions = {}): UseNewsReturn {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (subCategory) params.set('subCategory', subCategory);

      const response = await fetch(`/api/news?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.statusText}`);
      }

      const data = await response.json();
      setNews(data.items || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl');
    } finally {
      setLoading(false);
    }
  }, [category, subCategory]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchNews, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchNews]);

  return {
    news,
    loading,
    error,
    refresh: fetchNews,
    lastUpdated,
  };
}
