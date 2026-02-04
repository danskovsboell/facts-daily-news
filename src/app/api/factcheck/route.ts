import { NextRequest, NextResponse } from 'next/server';
import { factCheck, getCacheStats } from '@/lib/grok';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 45; // Single Grok web-search call

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, title, content, source, force } = body;

    console.log(`[factcheck API] POST received: articleId=${articleId}, force=${force}, hasTitle=${!!title}`);

    // If articleId provided, fetch article from Supabase
    let articleTitle = title;
    let articleContent = content;
    let articleSource = source;

    if (articleId) {
      const supabase = getSupabase();
      if (supabase) {
        const { data: article, error: fetchError } = await supabase
          .from('articles')
          .select('*')
          .eq('id', articleId)
          .single();

        if (fetchError || !article) {
          return NextResponse.json(
            { error: 'Article not found' },
            { status: 404 }
          );
        }

        articleTitle = article.title;
        articleContent = article.body || article.summary || '';
        articleSource = article.sources?.[0]?.source_name || 'AI-genereret';
      }
    }

    if (!articleTitle) {
      return NextResponse.json(
        { error: 'Title is required (provide articleId or title)' },
        { status: 400 }
      );
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'Grok API not configured', score: -1 },
        { status: 503 }
      );
    }

    // Full detailed fact-check with Grok web search
    // Pass force flag to skip cache when re-checking
    console.log(`[factcheck API] Calling factCheck for: "${articleTitle?.slice(0, 60)}..." force=${force}`);
    const result = await factCheck(articleTitle, articleContent || '', articleSource || 'unknown', force);
    console.log(`[factcheck API] factCheck returned: score=${result.score}, claims=${result.claims?.length}, method=${result.verificationMethod}`);

    // Save result back to Supabase if articleId provided
    if (articleId) {
      const supabase = getSupabase();
      if (supabase) {
        const factDetails = {
          claims: result.claims || [],
          sources_checked: result.sources || [],
          sourceLinks: result.sourceLinks || [],
          sourcesConsulted: result.sourcesConsulted || 0,
          verificationMethod: result.verificationMethod || 'web-search',
          summary: result.summary || '',
          checkedAt: result.checkedAt,
        };

        const { error: updateError } = await supabase
          .from('articles')
          .update({
            fact_score: result.score,
            fact_details: factDetails,
            updated_at: new Date().toISOString(),
          })
          .eq('id', articleId);

        if (updateError) {
          console.error('Failed to save fact-check result to Supabase:', updateError);
        } else {
          console.log(`✅ Saved fact-check result for article ${articleId}: score=${result.score}`);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fact-check API error:', error);
    return NextResponse.json(
      { error: 'Failed to fact-check article' },
      { status: 500 }
    );
  }
}

// GET endpoint for cache stats (debug)
export async function GET() {
  const stats = getCacheStats();
  return NextResponse.json({
    status: 'ok',
    grokConfigured: !!process.env.GROK_API_KEY,
    cache: stats,
  });
}
