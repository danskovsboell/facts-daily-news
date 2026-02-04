import { fetchAllFeeds } from '@/lib/rss';
import { fetchAllNewsAPI } from '@/lib/newsapi';
import { fetchMediastackDK } from '@/lib/mediastack';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { RawSource, NewsItem } from '@/lib/types';

function newsItemToRawSource(item: NewsItem): RawSource {
  return {
    id: item.id,
    title: item.title,
    description: item.description || '',
    url: item.link,
    source_name: item.source,
    published_at: item.pubDate,
    fetched_at: new Date().toISOString(),
    category: item.category,
    sub_category: item.subCategory,
    raw_content: item.content || item.description || '',
    processed: false,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function deduplicateByUrl(sources: RawSource[]): RawSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function ingestSources(): Promise<{ sources: RawSource[]; newCount: number }> {
  // Fetch from all providers in parallel
  const [rssItems, newsApiItems, mediastackItems] = await Promise.all([
    withTimeout(fetchAllFeeds(), 8000, []),
    withTimeout(fetchAllNewsAPI(), 6000, []),
    withTimeout(fetchMediastackDK(25), 5000, []),
  ]);

  const allItems = [...rssItems, ...newsApiItems, ...mediastackItems];
  const rawSources = deduplicateByUrl(allItems.map(newsItemToRawSource));

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (supabase) {
      // Upsert into raw_sources, skip duplicates by URL
      const { error } = await supabase
        .from('raw_sources')
        .upsert(
          rawSources.map((s) => ({
            title: s.title,
            description: s.description,
            url: s.url,
            source_name: s.source_name,
            published_at: s.published_at,
            category: s.category,
            sub_category: s.sub_category,
            raw_content: s.raw_content,
            processed: false,
          })),
          { onConflict: 'url', ignoreDuplicates: true },
        );

      if (error) {
        console.error('Supabase upsert error:', error);
      }

      // Return unprocessed sources from DB
      const { data } = await supabase
        .from('raw_sources')
        .select('*')
        .eq('processed', false)
        .order('fetched_at', { ascending: false })
        .limit(100);

      return {
        sources: (data as RawSource[]) || rawSources,
        newCount: rawSources.length,
      };
    }
  }

  // Fallback: return in-memory
  return { sources: rawSources, newCount: rawSources.length };
}
