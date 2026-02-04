import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { searchSingleInterest } from '@/lib/grok-search';
import { batchCategorize } from '@/lib/grok';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/trigger-search
 *
 * Immediately searches for news about a single interest using Grok web search
 * and inserts the results into raw_sources.
 *
 * Body: { interestName: string, searchPrompt?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // ── Validate environment ───────────────────────────────
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 },
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase client unavailable' },
        { status: 503 },
      );
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY not configured' },
        { status: 503 },
      );
    }

    // ── Parse body ─────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body.interestName !== 'string' || !body.interestName.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid interestName' },
        { status: 400 },
      );
    }

    const interestName = body.interestName.trim();
    const searchPrompt = typeof body.searchPrompt === 'string' ? body.searchPrompt.trim() : undefined;

    // ── Step 1: Search via Grok ────────────────────────────
    const result = await searchSingleInterest(interestName, searchPrompt);

    if (result.error) {
      return NextResponse.json(
        { error: 'Search failed', details: result.error },
        { status: 502 },
      );
    }

    if (result.stories.length === 0) {
      return NextResponse.json({
        inserted: 0,
        interest: interestName,
        source: 'grok_web_search',
        message: 'No stories found for this interest',
      });
    }

    // ── Step 2: Categorize stories ─────────────────────────
    const categorizations = await batchCategorize(
      result.stories.map((story) => ({
        title: story.title,
        content: story.summary?.slice(0, 300),
      })),
    ).catch((err) => {
      console.error('Batch categorize failed for trigger-search:', err);
      return null;
    });

    // ── Step 3: Build rows ─────────────────────────────────
    const rows = result.stories.map((story, idx) => {
      const cat = categorizations?.[idx];
      const category = cat && cat.confidence > 50 ? cat.category : story.category || 'verden';
      const subCategory = cat && cat.confidence > 50 ? cat.subCategory : 'generelt';

      return {
        title: story.title,
        description: story.summary || null,
        url: story.url,
        source_name: story.source || 'Grok Web Search',
        published_at: new Date().toISOString(),
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
      console.error('Supabase insert error (trigger-search):', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      inserted: data?.length || 0,
      total_discovered: result.stories.length,
      interest: interestName,
      source: 'grok_web_search',
      duration_ms: result.durationMs,
    });
  } catch (error) {
    console.error('Trigger-search error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger search', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    );
  }
}
