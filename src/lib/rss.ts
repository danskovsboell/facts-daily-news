import Parser from 'rss-parser';
import { NewsItem, FeedSource, Category, SubCategory } from './types';
import { FEED_SOURCES } from './constants';

const parser = new Parser({
  timeout: 5000, // 5s timeout per feed (strict for Vercel)
  headers: {
    'User-Agent': 'FactsDailyNews/1.0',
  },
});

function generateId(link: string): string {
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    const char = link.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractImageUrl(item: Record<string, unknown>): string | undefined {
  // Try common RSS image fields
  const mediaContent = item['media:content'] as { $?: { url?: string } } | undefined;
  if (mediaContent?.$?.url) return mediaContent.$.url;

  const enclosure = item.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.url && enclosure.type?.startsWith('image')) return enclosure.url;

  // Try to extract from content
  const content = (item.content || item['content:encoded']) as string | undefined;
  if (content) {
    const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
    if (imgMatch) return imgMatch[1];
  }

  return undefined;
}

export async function fetchFeed(source: FeedSource): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(source.url);

    return (feed.items || []).map((item) => ({
      id: generateId(item.link || item.guid || item.title || ''),
      title: item.title || 'Ingen overskrift',
      description: item.contentSnippet || item.content?.slice(0, 200) || '',
      content: item.content || item['content:encoded'] || '',
      link: item.link || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source: source.name,
      sourceUrl: source.url,
      category: source.category,
      subCategory: source.subCategory,
      imageUrl: extractImageUrl(item as Record<string, unknown>),
    }));
  } catch (error) {
    console.error(`Failed to fetch feed ${source.name}:`, error);
    return [];
  }
}

export async function fetchAllFeeds(
  category?: Category,
  subCategory?: SubCategory
): Promise<NewsItem[]> {
  let sources = FEED_SOURCES;

  if (category) {
    sources = sources.filter((s) => s.category === category);
  }
  if (subCategory) {
    sources = sources.filter((s) => s.subCategory === subCategory);
  }

  const results = await Promise.allSettled(sources.map((source) => fetchFeed(source)));

  const allItems: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // Sort by date, newest first
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return allItems;
}

export async function fetchFeedsByCategory(): Promise<Record<Category, NewsItem[]>> {
  const categories: Category[] = ['danmark', 'europa', 'verden', 'sladder'];
  const result: Record<string, NewsItem[]> = {};

  await Promise.all(
    categories.map(async (cat) => {
      result[cat] = await fetchAllFeeds(cat);
    })
  );

  return result as Record<Category, NewsItem[]>;
}
