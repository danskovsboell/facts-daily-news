import { NextRequest, NextResponse } from 'next/server';
import { fetchAllFeeds } from '@/lib/rss';
import { fetchTopHeadlines } from '@/lib/newsapi';
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

function getNewsCacheKey(category?: string, subCategory?: string): string {
  return `${category || 'all'}::${subCategory || 'all'}`;
}

// Dedup by title similarity
function deduplicateItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-zæøå0-9]/g, '').slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const cacheKey = getNewsCacheKey(category || undefined, subCategory || undefined);
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
      return NextResponse.json({
        items: cached.items,
        count: cached.items.length,
        fetchedAt: new Date(cached.timestamp).toISOString(),
        cached: true,
      });
    }

    // Fetch RSS + NewsAPI in parallel, with a hard 7s timeout
    const [rssItems, newsApiItems] = await Promise.all([
      withTimeout(fetchAllFeeds(), 7000, []),
      withTimeout(fetchTopHeadlines('dk'), 5000, []),
    ]);

    // Merge and deduplicate
    let allItems = deduplicateItems([...rssItems, ...newsApiItems]);

    if (allItems.length === 0) {
      return NextResponse.json({
        items: [],
        count: 0,
        fetchedAt: new Date().toISOString(),
      });
    }

    // Sort by date, newest first
    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Limit to top 20 for performance
    const topItems = allItems.slice(0, 20);

    let processedItems: NewsItem[];

    if (skipGrok || !process.env.GROK_API_KEY) {
      processedItems = topItems;
    } else {
      // Single batch categorization call to Grok (fast!) - with 8s timeout
      const categorizations = await withTimeout(
        batchCategorize(
          topItems.slice(0, 15).map(item => ({
            title: item.title,
            content: item.description?.slice(0, 200),
          }))
        ),
        8000,
        null
      ).catch(err => {
        console.error('Batch categorize failed:', err);
        return null;
      });

      // Apply categorizations to the top 15
      processedItems = topItems.map((item, index) => {
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

    // Filter by requested category/subcategory
    let filteredItems = processedItems;
    if (category) {
      filteredItems = processedItems.filter(item => item.category === category);
    }
    if (subCategory) {
      filteredItems = filteredItems.filter(item => item.subCategory === subCategory);
    }

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
