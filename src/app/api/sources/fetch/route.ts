import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { discoverNewsViaGrok } from '@/lib/grok-search';
import { batchCategorize } from '@/lib/grok';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Grok web search can take a while with multiple queries

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

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({ error: 'GROK_API_KEY not configured' }, { status: 503 });
    }

    // ── Step 1: Discover news via Grok web search ──────────
    const discovery = await discoverNewsViaGrok();

    if (discovery.stories.length === 0) {
      return NextResponse.json({
        inserted: 0,
        source: 'grok_web_search',
        errors: discovery.errors.length > 0 ? discovery.errors : undefined,
      });
    }

    // ── Step 2: Batch categorize all stories with Grok ─────
    // This gives us proper category (danmark/europa/verden/sladder) and sub_category (generelt/finans)
    const categorizations = await batchCategorize(
      discovery.stories.map(story => ({
        title: story.title,
        content: story.summary?.slice(0, 300),
      }))
    ).catch(err => {
      console.error('Batch categorize failed:', err);
      return null;
    });

    // ── Step 3: Build rows for Supabase ────────────────────
    const rows = discovery.stories.map((story, idx) => {
      // Use Grok categorization if available, otherwise fall back to search query category
      const cat = categorizations?.[idx];
      const category = (cat && cat.confidence > 50) ? cat.category : story.category;
      const subCategory = (cat && cat.confidence > 50) ? cat.subCategory : 'generelt';

      // Use the actual published_date from Grok if available, otherwise fallback to now
      let publishedAt = new Date().toISOString();
      if (story.published_date) {
        try {
          const parsed = new Date(story.published_date);
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed.toISOString();
          }
        } catch {
          // Keep fallback
        }
      }

      return {
        title: story.title,
        description: story.summary || null,
        url: story.url,
        source_name: story.source || 'Grok Web Search',
        published_at: publishedAt,
        category,
        sub_category: subCategory,
        raw_content: story.summary || '',
        processed: false,
      };
    });

    // ── Step 4: Upsert into raw_sources ────────────────────
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
      total_discovered: discovery.stories.length,
      source: 'grok_web_search',
      searches: discovery.totalSearches,
      duration_ms: discovery.totalDurationMs,
      categorized: categorizations ? Math.min(discovery.stories.length, categorizations.length) : 0,
      errors: discovery.errors.length > 0 ? discovery.errors : undefined,
      interest_source: discovery.interestSource,
      breakdown: discovery.results.map(r => ({
        query: r.query,
        stories: r.stories.length,
        web_searches: r.searchCalls,
        duration_ms: r.durationMs,
        error: r.error || undefined,
      })),
    });
  } catch (error) {
    console.error('Sources fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
