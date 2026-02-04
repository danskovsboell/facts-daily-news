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

/** Keywords map for matching interests to article tags */
const INTEREST_KEYWORDS: Record<string, string[]> = {
  'Tesla': ['tesla', 'elon musk', 'spacex', 'musk', 'cybertruck', 'model 3', 'model y', 'model s', 'model x', 'supercharger', 'gigafactory'],
  'AI': ['ai', 'kunstig intelligens', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'grok', 'claude', 'deepmind', 'neural', 'llm'],
  'Grøn Energi': ['grøn energi', 'green energy', 'vedvarende', 'renewable', 'solenergi', 'solar', 'vindenergi', 'vindmølle', 'bæredygtig', 'sustainable', 'klima', 'climate', 'co2', 'elbil', 'hydrogen'],
  'Økonomi & Finans': ['økonomi', 'economy', 'finans', 'finance', 'aktie', 'stock', 'marked', 'market', 'investering', 'inflation', 'bnp', 'gdp', 'vækst', 'handel', 'valuta', 'bank', 'børs'],
  'Renter': ['rente', 'interest rate', 'centralbank', 'ecb', 'nationalbanken', 'fed', 'federal reserve', 'pengepolitik', 'monetary', 'obligat', 'realkredit', 'boliglån', 'mortgage'],
  'Politik': ['politik', 'government', 'election', 'valg', 'parti', 'minister', 'folketinget', 'parliament'],
  'Sundhed': ['sundhed', 'health', 'hospital', 'medicin', 'vaccine', 'patient', 'behandling'],
  'Tech': ['tech', 'teknologi', 'software', 'hardware', 'computer', 'digital', 'app', 'startup'],
  'Klima': ['klima', 'climate', 'global opvarmning', 'co2', 'emission', 'miljø', 'environment'],
  'Krypto': ['krypto', 'crypto', 'bitcoin', 'ethereum', 'blockchain', 'nft'],
  'Ejendomme': ['ejendom', 'bolig', 'hus', 'lejlighed', 'real estate', 'property', 'boligmarked'],
  'Sport': ['sport', 'fodbold', 'håndbold', 'tennis', 'olympisk', 'champions league', 'superliga'],
  'Kultur': ['kultur', 'kunst', 'musik', 'film', 'teater', 'museum', 'litteratur'],
  'Videnskab': ['videnskab', 'science', 'forskning', 'research', 'studie', 'universitet'],
  'Startups': ['startup', 'iværksætter', 'venture', 'funding', 'serie a', 'accelerator'],
};

/** Calculate how well an article matches user interests */
function getInterestScore(article: Article, interests: string[]): number {
  let score = 0;
  const tags = (article.interest_tags || []).map(t => t.toLowerCase());
  const titleLower = article.title.toLowerCase();
  const summaryLower = (article.summary || '').toLowerCase();
  const searchText = `${titleLower} ${summaryLower} ${tags.join(' ')}`;

  for (const interest of interests) {
    const interestLower = interest.toLowerCase();

    // Direct tag match (strongest signal)
    if (tags.some(tag => tag === interestLower || tag.includes(interestLower) || interestLower.includes(tag))) {
      score += 3;
      continue;
    }

    // Keyword match in title/summary/tags
    const keywords = INTEREST_KEYWORDS[interest] || [interestLower];
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        score += 2;
        break;
      }
    }
  }

  return score;
}

/** Sort articles: interest-matching first, then by created_at */
function prioritizeArticles(articles: Article[], interests: string[]): Article[] {
  if (!interests.length) return articles;

  return [...articles].sort((a, b) => {
    const scoreA = getInterestScore(a, interests);
    const scoreB = getInterestScore(b, interests);
    if (scoreA !== scoreB) return scoreB - scoreA; // Higher interest score first
    // Same score: keep chronological (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
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
