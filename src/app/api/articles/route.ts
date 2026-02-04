import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Category, SubCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured', articles: [] },
        { status: 503 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client unavailable', articles: [] }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as Category | null;
    const subCategory = searchParams.get('subCategory') as SubCategory | null;
    const tag = searchParams.get('tag');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    // ALWAYS only show today's articles (midnight UTC) — no bypass
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const todayMidnightISO = todayMidnight.toISOString();

    // Try ordering by news_date first; if column doesn't exist, fallback to created_at only
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('published', true)
      .gte('created_at', todayMidnightISO)
      .order('news_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }
    if (subCategory) {
      query = query.eq('sub_category', subCategory);
    }
    if (tag) {
      query = query.contains('interest_tags', [tag]);
    }

    let { data: articles, error, count } = await query;

    // If news_date column doesn't exist yet, retry without it
    if (error && error.message?.includes('news_date')) {
      console.warn('⚠️ news_date column not found, falling back to created_at order');
      let fallbackQuery = supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .eq('published', true)
        .gte('created_at', todayMidnightISO)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category) {
        fallbackQuery = fallbackQuery.eq('category', category);
      }
      if (subCategory) {
        fallbackQuery = fallbackQuery.eq('sub_category', subCategory);
      }
      if (tag) {
        fallbackQuery = fallbackQuery.contains('interest_tags', [tag]);
      }

      const fallbackResult = await fallbackQuery;
      articles = fallbackResult.data;
      error = fallbackResult.error;
      count = fallbackResult.count;
    }

    if (error) {
      console.error('Supabase articles query error:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message, articles: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      articles: articles || [],
      count: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (error) {
    console.error('Articles API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles', articles: [] },
      { status: 500 }
    );
  }
}
