import { NewsItem } from './types';

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const MEDIASTACK_KEY = process.env.MEDIASTACK_KEY;

/**
 * Fetch top headlines from NewsAPI
 * Placeholder - requires NEWSAPI_KEY in .env.local
 * https://newsapi.org/docs
 */
export async function fetchTopHeadlines(
  country: string = 'dk',
  category?: string
): Promise<NewsItem[]> {
  if (!NEWSAPI_KEY) {
    console.log('NewsAPI key not configured - skipping');
    return [];
  }

  try {
    const params = new URLSearchParams({
      apiKey: NEWSAPI_KEY,
      country,
      ...(category && { category }),
    });

    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?${params}`,
      { next: { revalidate: 300 } } // Cache for 5 min
    );

    const data = await response.json();

    if (data.status !== 'ok') {
      console.error('NewsAPI error:', data.message);
      return [];
    }

    return data.articles.map((article: {
      title: string;
      description: string;
      content: string;
      url: string;
      publishedAt: string;
      source: { name: string };
      urlToImage: string;
    }) => ({
      id: Buffer.from(article.url).toString('base64').slice(0, 12),
      title: article.title,
      description: article.description || '',
      content: article.content || '',
      link: article.url,
      pubDate: article.publishedAt,
      source: article.source.name,
      sourceUrl: article.url,
      category: 'danmark' as const,
      subCategory: 'generelt' as const,
      imageUrl: article.urlToImage,
    }));
  } catch (error) {
    console.error('NewsAPI fetch error:', error);
    return [];
  }
}

/**
 * Fetch news from Mediastack API
 * Placeholder - requires MEDIASTACK_KEY in .env.local
 * https://mediastack.com/documentation
 */
export async function fetchMediastack(
  countries: string = 'dk',
  categories?: string
): Promise<NewsItem[]> {
  if (!MEDIASTACK_KEY) {
    console.log('Mediastack key not configured - skipping');
    return [];
  }

  try {
    const params = new URLSearchParams({
      access_key: MEDIASTACK_KEY,
      countries,
      ...(categories && { categories }),
      languages: 'da,en',
      limit: '25',
    });

    const response = await fetch(`http://api.mediastack.com/v1/news?${params}`);
    const data = await response.json();

    if (data.error) {
      console.error('Mediastack error:', data.error);
      return [];
    }

    return (data.data || []).map((article: {
      title: string;
      description: string;
      url: string;
      published_at: string;
      source: string;
      image: string;
      category: string;
    }) => ({
      id: Buffer.from(article.url).toString('base64').slice(0, 12),
      title: article.title,
      description: article.description || '',
      link: article.url,
      pubDate: article.published_at,
      source: article.source,
      sourceUrl: article.url,
      category: 'danmark' as const,
      subCategory: 'generelt' as const,
      imageUrl: article.image,
    }));
  } catch (error) {
    console.error('Mediastack fetch error:', error);
    return [];
  }
}
