import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchAllFeeds } from '@/lib/rss';
import { fetchAllNewsAPI } from '@/lib/newsapi';
import { fetchMediastackDK } from '@/lib/mediastack';
import { batchCategorize } from '@/lib/grok';
import { NewsItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

// Dedup by URL
function deduplicateItems(items: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const result: NewsItem[] = [];
  for (const item of items) {
    const urlKey = item.link?.toLowerCase().replace(/\/$/, '');
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (urlKey) seenUrls.add(urlKey);
    result.push(item);
  }
  return result;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured', hint: 'Set SUPABASE_URL and SUPABASE_ANON_KEY' },
        { status: 503 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client unavailable' }, { status: 503 });
    }

    // Fetch from all sources in parallel
    const [rssItems, newsApiItems, mediastackItems] = await Promise.all([
      withTimeout(fetchAllFeeds(), 8000, []),
      withTimeout(fetchAllNewsAPI(), 6000, []),
      withTimeout(fetchMediastackDK(25), 5000, []),
    ]);

    const allItems = deduplicateItems([...rssItems, ...newsApiItems, ...mediastackItems]);

    if (allItems.length === 0) {
      return NextResponse.json({
        inserted: 0,
        sources: { rss: 0, newsapi: 0, mediastack: 0 },
      });
    }

    // Batch categorize top items with Grok
    const topItems = allItems.slice(0, 30);
    const categorizations = await withTimeout(
      batchCategorize(topItems.map(item => ({
        title: item.title,
        content: item.description?.slice(0, 200),
      }))),
      12000,
      null
    ).catch(() => null);

    // Apply categorizations
    if (categorizations) {
      for (let i = 0; i < Math.min(topItems.length, categorizations.length); i++) {
        const cat = categorizations[i];
        if (cat && cat.confidence > 60) {
          topItems[i].category = cat.category;
          topItems[i].subCategory = cat.subCategory;
        }
      }
    }

    // Upsert into raw_sources (ignore duplicates via URL)
    const rows = allItems.map((item, idx) => ({
      title: item.title,
      description: item.description || null,
      url: item.link,
      source_name: item.source,
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      category: idx < topItems.length ? topItems[idx].category : item.category,
      sub_category: idx < topItems.length ? topItems[idx].subCategory : item.subCategory,
      raw_content: (item.content || item.description || '').slice(0, 5000),
      processed: false,
    }));

    const { data, error } = await supabase
      .from('raw_sources')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message, hint: 'Run supabase/setup.sql in SQL Editor' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      inserted: data?.length || 0,
      total_fetched: allItems.length,
      sources: {
        rss: rssItems.length,
        newsapi: newsApiItems.length,
        mediastack: mediastackItems.length,
      },
      categorized: categorizations ? Math.min(topItems.length, categorizations.length) : 0,
    });
  } catch (error) {
    console.error('Sources fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
