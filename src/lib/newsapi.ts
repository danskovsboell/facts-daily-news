import { NewsItem, Category, SubCategory } from './types';

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const NEWSAPI_BASE = 'https://newsapi.org/v2';

// ============================================================
// Hjælper: generér stabil ID fra URL
// ============================================================
function generateId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'napi_' + Math.abs(hash).toString(36);
}

// ============================================================
// Hjælper: map NewsAPI category til vores Category
// ============================================================
function mapCategory(napiCategory: string, country: string): { category: Category; subCategory: SubCategory } {
  const sub: SubCategory = ['business', 'finance'].includes(napiCategory) ? 'finans' : 'generelt';

  if (country === 'dk' || country === 'da') {
    return { category: 'danmark', subCategory: sub };
  }
  if (['de', 'fr', 'gb', 'it', 'es', 'nl', 'se', 'no', 'fi', 'at', 'ch', 'be', 'pl'].includes(country)) {
    return { category: 'europa', subCategory: sub };
  }
  return { category: 'verden', subCategory: sub };
}

// ============================================================
// Hjælper: fælles article → NewsItem mapping
// ============================================================
interface NewsAPIArticle {
  title: string | null;
  description: string | null;
  content: string | null;
  url: string;
  publishedAt: string;
  source: { id: string | null; name: string };
  urlToImage: string | null;
  author: string | null;
}

function articleToNewsItem(
  article: NewsAPIArticle,
  category: Category,
  subCategory: SubCategory
): NewsItem | null {
  // NewsAPI sender sommetider "[Removed]" placeholder-artikler
  if (!article.title || article.title === '[Removed]') return null;
  if (!article.url || article.url === 'https://removed.com') return null;

  return {
    id: generateId(article.url),
    title: article.title,
    description: article.description || '',
    content: article.content || '',
    link: article.url,
    pubDate: article.publishedAt || new Date().toISOString(),
    source: article.source?.name || 'NewsAPI',
    sourceUrl: article.url,
    category,
    subCategory,
    imageUrl: article.urlToImage || undefined,
  };
}

// ============================================================
// Fetch top headlines fra et bestemt land/kategori
// ============================================================
export async function fetchTopHeadlines(
  country: string = 'us',
  napiCategory?: string,
  pageSize: number = 15
): Promise<NewsItem[]> {
  if (!NEWSAPI_KEY) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      apiKey: NEWSAPI_KEY,
      country,
      pageSize: String(pageSize),
    });
    if (napiCategory) params.set('category', napiCategory);

    const response = await fetch(`${NEWSAPI_BASE}/top-headlines?${params}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(`NewsAPI top-headlines ${response.status}:`, await response.text());
      return [];
    }

    const data = await response.json();
    if (data.status !== 'ok') {
      console.error('NewsAPI error:', data.message || data.code);
      return [];
    }

    const { category, subCategory } = mapCategory(napiCategory || 'general', country);

    return (data.articles || [])
      .map((a: NewsAPIArticle) => articleToNewsItem(a, category, subCategory))
      .filter((item: NewsItem | null): item is NewsItem => item !== null);
  } catch (error) {
    console.error(`NewsAPI top-headlines (${country}/${napiCategory}) error:`, error);
    return [];
  }
}

// ============================================================
// Fetch "everything" – bredere søgning, god til dansk indhold
// ============================================================
export async function fetchEverything(
  query: string,
  options: {
    language?: string;
    sortBy?: 'publishedAt' | 'relevancy' | 'popularity';
    pageSize?: number;
    category?: Category;
    subCategory?: SubCategory;
  } = {}
): Promise<NewsItem[]> {
  if (!NEWSAPI_KEY) {
    return [];
  }

  const {
    language = 'en',
    sortBy = 'publishedAt',
    pageSize = 15,
    category = 'verden',
    subCategory = 'generelt',
  } = options;

  try {
    const params = new URLSearchParams({
      apiKey: NEWSAPI_KEY,
      q: query,
      language,
      sortBy,
      pageSize: String(pageSize),
    });

    const response = await fetch(`${NEWSAPI_BASE}/everything?${params}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(`NewsAPI everything ${response.status}:`, await response.text());
      return [];
    }

    const data = await response.json();
    if (data.status !== 'ok') {
      console.error('NewsAPI everything error:', data.message || data.code);
      return [];
    }

    return (data.articles || [])
      .map((a: NewsAPIArticle) => articleToNewsItem(a, category, subCategory))
      .filter((item: NewsItem | null): item is NewsItem => item !== null);
  } catch (error) {
    console.error(`NewsAPI everything (${query}) error:`, error);
    return [];
  }
}

// ============================================================
// Hent alle NewsAPI-nyheder – samlet funktion
// Henter headlines fra flere lande/kategorier + everything-søgninger
// ============================================================
export async function fetchAllNewsAPI(): Promise<NewsItem[]> {
  if (!NEWSAPI_KEY) {
    console.log('NewsAPI key not configured – skipping');
    return [];
  }

  // Kør alle fetches parallelt
  const results = await Promise.allSettled([
    // Top headlines – internationale
    fetchTopHeadlines('us', 'general', 10),
    fetchTopHeadlines('us', 'business', 8),
    fetchTopHeadlines('gb', 'general', 8),
    fetchTopHeadlines('gb', 'business', 5),

    // Europa headlines
    fetchTopHeadlines('de', 'general', 5),
    fetchTopHeadlines('fr', 'general', 5),

    // Everything – dansk-relateret
    fetchEverything('Danmark OR dansk OR Copenhagen', {
      language: 'en',
      pageSize: 10,
      category: 'danmark',
      subCategory: 'generelt',
    }),

    // Everything – finans/business
    fetchEverything('stock market OR economy OR finance', {
      language: 'en',
      pageSize: 8,
      category: 'verden',
      subCategory: 'finans',
    }),

    // Sladder hentes ikke aktivt – Grok kategoriserer lette/uvæsentlige nyheder som "sladder"
  ]);

  const allItems: NewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        // Dedup på URL
        if (!seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          allItems.push(item);
        }
      }
    }
  }

  // Sortér nyeste først
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  console.log(`NewsAPI: fetched ${allItems.length} unique articles`);
  return allItems;
}
