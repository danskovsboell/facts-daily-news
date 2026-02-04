import { NextRequest, NextResponse } from 'next/server';
import { fetchAllFeeds } from '@/lib/rss';
import { fetchAllNewsAPI } from '@/lib/newsapi';
import { batchCategorize } from '@/lib/grok';
import { Category, SubCategory, NewsItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

// In-memory cache for processed news
interface NewsCache {
  items: NewsItem[];
  timestamp: number;
}

const newsCache = new Map<string, NewsCache>();
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 min

function getNewsCacheKey(category?: string, subCategory?: string, skipGrok?: boolean): string {
  return `${category || 'all'}::${subCategory || 'all'}${skipGrok ? '::skip' : ''}`;
}

// Dedup by URL + title fallback
function deduplicateItems(items: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: NewsItem[] = [];

  for (const item of items) {
    // Primær: URL-baseret dedup
    const urlKey = item.link?.toLowerCase().replace(/\/$/, '');
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (urlKey) seenUrls.add(urlKey);

    // Sekundær: titel-dedup (fanger samme historie fra forskellige kilder)
    const titleKey = item.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);

    result.push(item);
  }
  return result;
}

// Race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as Category | null;
    const subCategory = searchParams.get('subCategory') as SubCategory | null;
    const skipGrok = searchParams.get('skipGrok') === 'true';

    // Check cache first
    const cacheKey = getNewsCacheKey(category || undefined, subCategory || undefined, skipGrok);
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
      return NextResponse.json({
        items: cached.items,
        count: cached.items.length,
        fetchedAt: new Date(cached.timestamp).toISOString(),
        cached: true,
      });
    }

    // Fetch RSS + NewsAPI i parallelt, med timeout
    const [rssItems, newsApiItems] = await Promise.all([
      withTimeout(fetchAllFeeds(), 8000, []),
      withTimeout(fetchAllNewsAPI(), 6000, []),
    ]);

    // Merge og dedup
    const allItems = deduplicateItems([...rssItems, ...newsApiItems]);

    if (allItems.length === 0) {
      return NextResponse.json({
        items: [],
        count: 0,
        fetchedAt: new Date().toISOString(),
        sources: { rss: rssItems.length, newsapi: newsApiItems.length },
      });
    }

    // Sort by date, nyeste først
    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    let processedItems: NewsItem[];

    if (skipGrok || !process.env.GROK_API_KEY) {
      processedItems = allItems;
    } else {
      // Grok batch-kategorisering af top 15 nyeste (single API call)
      const topForGrok = allItems.slice(0, 15);
      const categorizations = await withTimeout(
        batchCategorize(
          topForGrok.map(item => ({
            title: item.title,
            content: item.description?.slice(0, 200),
          }))
        ),
        12000,
        null
      ).catch(err => {
        console.error('Batch categorize failed:', err);
        return null;
      });

      // Anvend kategoriseringer
      processedItems = allItems.map((item, index) => {
        if (index >= 15 || !categorizations) return item;
        const cat = categorizations[index];
        if (!cat) return item;

        return {
          ...item,
          grokCategory: cat.category,
          grokSubCategory: cat.subCategory,
          isGossip: cat.isGossip,
          region: cat.region,
          category: cat.confidence > 60 ? cat.category : item.category,
          subCategory: cat.confidence > 60 ? cat.subCategory : item.subCategory,
        };
      });
    }

    // Filtrér efter ønsket kategori
    let filteredItems = processedItems;
    if (category) {
      filteredItems = processedItems.filter(item => item.category === category);
    }
    if (subCategory) {
      filteredItems = filteredItems.filter(item => item.subCategory === subCategory);
    }

    // Sort by date
    filteredItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Cache
    newsCache.set(cacheKey, {
      items: filteredItems,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      items: filteredItems,
      count: filteredItems.length,
      fetchedAt: new Date().toISOString(),
      grokEnabled: !!process.env.GROK_API_KEY,
      sources: { rss: rssItems.length, newsapi: newsApiItems.length },
    });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', items: [] },
      { status: 500 }
    );
  }
}
