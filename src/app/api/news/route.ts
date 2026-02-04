import { NextRequest, NextResponse } from 'next/server';
import { fetchAllFeeds } from '@/lib/rss';
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as Category | null;
    const subCategory = searchParams.get('subCategory') as SubCategory | null;
    const skipGrok = searchParams.get('skipGrok') === 'true';

    // Check cache
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

    // Fetch RSS feeds (no category filter yet - we want Grok to recategorize)
    const allItems = await fetchAllFeeds();

    if (allItems.length === 0) {
      return NextResponse.json({
        items: [],
        count: 0,
        fetchedAt: new Date().toISOString(),
      });
    }

    // Limit to top 15 newest items for categorization (keeps Grok call fast)
    const topItems = allItems.slice(0, 15);

    let processedItems: NewsItem[];

    if (skipGrok || !process.env.GROK_API_KEY) {
      processedItems = allItems;
    } else {
      // Single batch categorization call to Grok (fast!)
      const categorizations = await batchCategorize(
        topItems.map(item => ({
          title: item.title,
          content: item.description?.slice(0, 200),
        }))
      ).catch(err => {
        console.error('Batch categorize failed:', err);
        return null;
      });

      // Apply categorizations
      processedItems = topItems.map((item, index) => {
        const cat = categorizations?.[index];
        if (!cat) return item;

        return {
          ...item,
          grokCategory: cat.category,
          grokSubCategory: cat.subCategory,
          isGossip: cat.isGossip,
          region: cat.region,
          // Grok overrides category if confident
          category: cat.confidence > 60 ? cat.category : item.category,
          subCategory: cat.confidence > 60 ? cat.subCategory : item.subCategory,
        };
      });

      // Add remaining items (beyond top 15) with original categories
      if (allItems.length > 15) {
        processedItems.push(...allItems.slice(15));
      }
    }

    // Now filter by requested category
    let filteredItems = processedItems;
    if (category) {
      filteredItems = processedItems.filter(item => item.category === category);
    }
    if (subCategory) {
      filteredItems = filteredItems.filter(item => item.subCategory === subCategory);
    }

    // Sort by date
    filteredItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Cache all categories at once
    newsCache.set(cacheKey, {
      items: filteredItems,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      items: filteredItems,
      count: filteredItems.length,
      fetchedAt: new Date().toISOString(),
      grokEnabled: !!process.env.GROK_API_KEY,
    });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', items: [] },
      { status: 500 }
    );
  }
}
