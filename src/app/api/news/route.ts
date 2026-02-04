import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Category, SubCategory, NewsItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/**
 * GET /api/news - Returns news from the articles table (generated from Grok-discovered sources).
 * 
 * This route now serves articles from the database rather than fetching from RSS/NewsAPI.
 * The pipeline is: Grok discovers news → raw_sources → articles/generate → articles table
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as Category | null;
    const subCategory = searchParams.get('subCategory') as SubCategory | null;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        items: [],
        count: 0,
        error: 'Supabase not configured',
      });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        items: [],
        count: 0,
        error: 'Supabase client unavailable',
      });
    }

    // Fetch recent raw_sources as NewsItem-compatible objects
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('raw_sources')
      .select('*')
      .gte('fetched_at', oneDayAgo)
      .order('fetched_at', { ascending: false })
      .limit(50);

    if (category) {
      query = query.eq('category', category);
    }
    if (subCategory) {
      query = query.eq('sub_category', subCategory);
    }

    const { data: rawSources, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({
        items: [],
        count: 0,
        error: error.message,
      });
    }

    // Map raw_sources to NewsItem format for backwards compatibility
    const items: NewsItem[] = (rawSources || []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      title: s.title as string,
      description: (s.description as string) || '',
      content: (s.raw_content as string) || '',
      link: s.url as string,
      pubDate: (s.published_at as string) || (s.fetched_at as string) || new Date().toISOString(),
      source: (s.source_name as string) || 'Grok Web Search',
      sourceUrl: s.url as string,
      category: (s.category as Category) || 'verden',
      subCategory: (s.sub_category as SubCategory) || 'generelt',
    }));

    return NextResponse.json({
      items,
      count: items.length,
      fetchedAt: new Date().toISOString(),
      source: 'grok_web_search',
    });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', items: [] },
      { status: 500 }
    );
  }
}
