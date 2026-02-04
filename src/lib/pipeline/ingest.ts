import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { discoverNewsViaGrok } from '@/lib/grok-search';
import { RawSource } from '@/lib/types';

/**
 * Ingest news sources via Grok web search.
 * Discovers current news and stores them in the raw_sources table.
 */
export async function ingestSources(): Promise<{ sources: RawSource[]; newCount: number }> {
  // Discover news via Grok web search
  const discovery = await discoverNewsViaGrok();

  const rawSources: RawSource[] = discovery.stories.map((story, idx) => ({
    id: `grok_${idx}_${Date.now()}`,
    title: story.title,
    description: story.summary || '',
    url: story.url,
    source_name: story.source || 'Grok Web Search',
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    category: (story.category as RawSource['category']) || 'verden',
    sub_category: 'generelt' as const,
    raw_content: story.summary || '',
    processed: false,
  }));

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
