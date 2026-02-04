import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client unavailable' }, { status: 503 });
    }

    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('published', true)
      .single();

    if (error || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Also fetch related articles (same category, recent)
    const { data: related } = await supabase
      .from('articles')
      .select('id, title, summary, category, fact_score, created_at')
      .eq('category', article.category)
      .eq('published', true)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      article,
      related: related || [],
    });
  } catch (error) {
    console.error('Article detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}
