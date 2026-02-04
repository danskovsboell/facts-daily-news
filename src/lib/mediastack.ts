import { NewsItem, Category, SubCategory } from './types';

const MEDIASTACK_KEY = process.env.MEDIASTACK_KEY;
const MEDIASTACK_BASE = 'https://api.mediastack.com/v1';

// ============================================================
// Hjælper: stabil ID fra URL
// ============================================================
function generateId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'ms_' + Math.abs(hash).toString(36);
}

// ============================================================
// Mediastack article type
// ============================================================
interface MediastackArticle {
  title: string | null;
  description: string | null;
  url: string;
  source: string;
  image: string | null;
  category: string;
  language: string;
  country: string;
  published_at: string;
  author: string | null;
}

// ============================================================
// Map Mediastack category → vores Category/SubCategory
// ============================================================
function mapCategory(msCategory: string, country: string): { category: Category; subCategory: SubCategory } {
  const sub: SubCategory = ['business', 'finance'].includes(msCategory) ? 'finans' : 'generelt';

  if (country === 'dk') {
    return { category: 'danmark', subCategory: sub };
  }
  if (['de', 'fr', 'gb', 'it', 'es', 'nl', 'se', 'no', 'fi', 'at', 'ch', 'be', 'pl'].includes(country)) {
    return { category: 'europa', subCategory: sub };
  }
  if (['entertainment', 'sports'].includes(msCategory)) {
    return { category: 'sladder', subCategory: 'generelt' };
  }
  return { category: 'verden', subCategory: sub };
}

// ============================================================
// Fetch danske nyheder fra Mediastack
// ============================================================
export async function fetchMediastackDK(
  limit: number = 25
): Promise<NewsItem[]> {
  if (!MEDIASTACK_KEY) {
    console.log('Mediastack key not configured – skipping');
    return [];
  }

  try {
    // Mediastack free plan: no 'sort' param, limited 'countries'.
    // Denmark ('dk') may return 0 results; fall back to keywords + EN sources.
    const params = new URLSearchParams({
      access_key: MEDIASTACK_KEY,
      keywords: 'Denmark,Danish,Copenhagen,Novo Nordisk,Mærsk',
      languages: 'en',
      limit: String(limit),
    });

    const response = await fetch(`${MEDIASTACK_BASE}/news?${params}`);

    if (!response.ok) {
      console.error(`Mediastack ${response.status}:`, await response.text());
      return [];
    }

    const data = await response.json();

    if (data.error) {
      console.error('Mediastack API error:', data.error);
      return [];
    }

    const articles: MediastackArticle[] = data.data || [];

    return articles
      .filter((a) => a.title && a.url)
      .map((a) => {
        const { category, subCategory } = mapCategory(a.category || 'general', a.country || 'dk');
        return {
          id: generateId(a.url),
          title: a.title!,
          description: a.description || '',
          content: a.description || '',
          link: a.url,
          pubDate: a.published_at || new Date().toISOString(),
          source: a.source || 'Mediastack',
          sourceUrl: a.url,
          category,
          subCategory,
          imageUrl: a.image || undefined,
        };
      });
  } catch (error) {
    console.error('Mediastack fetch error:', error);
    return [];
  }
}

// ============================================================
// Fetch internationale nyheder fra Mediastack
// ============================================================
export async function fetchMediastackInternational(
  countries: string = 'us,gb,de',
  categories?: string,
  limit: number = 20
): Promise<NewsItem[]> {
  if (!MEDIASTACK_KEY) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      access_key: MEDIASTACK_KEY,
      countries,
      languages: 'en',
      limit: String(limit),
    });
    if (categories) params.set('categories', categories);

    const response = await fetch(`${MEDIASTACK_BASE}/news?${params}`);

    if (!response.ok) {
      console.error(`Mediastack intl ${response.status}:`, await response.text());
      return [];
    }

    const data = await response.json();
    if (data.error) {
      console.error('Mediastack intl error:', data.error);
      return [];
    }

    const articles: MediastackArticle[] = data.data || [];

    return articles
      .filter((a) => a.title && a.url)
      .map((a) => {
        const { category, subCategory } = mapCategory(a.category || 'general', a.country || 'us');
        return {
          id: generateId(a.url),
          title: a.title!,
          description: a.description || '',
          content: a.description || '',
          link: a.url,
          pubDate: a.published_at || new Date().toISOString(),
          source: a.source || 'Mediastack',
          sourceUrl: a.url,
          category,
          subCategory,
          imageUrl: a.image || undefined,
        };
      });
  } catch (error) {
    console.error('Mediastack intl error:', error);
    return [];
  }
}

// ============================================================
// Hent alt fra Mediastack – samlet funktion
// ============================================================
export async function fetchAllMediastack(): Promise<NewsItem[]> {
  if (!MEDIASTACK_KEY) {
    console.log('Mediastack key not configured – skipping');
    return [];
  }

  const results = await Promise.allSettled([
    fetchMediastackDK(25),
    fetchMediastackInternational('us,gb', 'general,business', 15),
    fetchMediastackInternational('de,fr,se,no', 'general', 10),
  ]);

  const allItems: NewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        if (!seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          allItems.push(item);
        }
      }
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  console.log(`Mediastack: fetched ${allItems.length} unique articles`);
  return allItems;
}
