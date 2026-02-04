import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { RawSource } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const ARTICLE_MODEL = 'grok-3-mini';

// Group related sources by similarity in title
function groupSources(sources: RawSource[]): RawSource[][] {
  const groups: RawSource[][] = [];
  const used = new Set<string>();

  for (const source of sources) {
    if (used.has(source.id)) continue;

    const group = [source];
    used.add(source.id);

    // Find related sources (similar titles)
    const titleWords = new Set(
      source.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    for (const other of sources) {
      if (used.has(other.id)) continue;
      if (other.category !== source.category) continue;

      const otherWords = other.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = otherWords.filter(w => titleWords.has(w)).length;

      // At least 2 significant words in common
      if (overlap >= 2) {
        group.push(other);
        used.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

async function generateArticle(sources: RawSource[]): Promise<{
  title: string;
  summary: string;
  body: string;
  fact_score: number;
  fact_details: { claims: { text: string; verdict: string; explanation: string }[]; sources_checked: string[] };
  category: string;
  sub_category: string;
  interest_tags: string[];
  is_gossip: boolean;
} | null> {
  if (!GROK_API_KEY) return null;

  const sourcesText = sources.map((s, i) =>
    `Kilde ${i + 1}: ${s.source_name}\nOverskrift: ${s.title}\nBeskrivelse: ${s.description || '(ingen)'}\nIndhold: ${(s.raw_content || '').slice(0, 1500)}\nURL: ${s.url}`
  ).join('\n\n');

  const systemPrompt = `Du er en professionel nyhedsjournalist. Skriv en original dansk artikel baseret på følgende kilder.

REGLER:
- Skriv på dansk
- Vær objektiv og faktuel
- Brug dine egne formuleringer – kopier IKKE direkte fra kilderne
- Inkluder alle vigtige fakta fra kilderne
- Angiv aldrig at du er en AI
- Artiklen skal have: overskrift, kort opsummering (1-2 sætninger), og brødtekst i markdown
- Fakta-tjek alle påstande mod kilderne og giv en samlet score 0-100
- Body skal være mindst 200 ord

SVAR I JSON FORMAT:
{
  "title": "...",
  "summary": "...",
  "body": "...",
  "fact_score": 85,
  "fact_details": { "claims": [{"text":"...","verdict":"true|mostly-true|mixed|false","explanation":"..."}], "sources_checked": ["kilde1.dk"] },
  "category": "danmark|europa|verden|sladder",
  "sub_category": "generelt|finans",
  "interest_tags": ["ai", "tesla"],
  "is_gossip": false
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARTICLE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sourcesText },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Grok article generation failed (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    return {
      title: parsed.title || sources[0].title,
      summary: parsed.summary || '',
      body: parsed.body || '',
      fact_score: Math.min(100, Math.max(0, Number(parsed.fact_score) || 70)),
      fact_details: parsed.fact_details || { claims: [], sources_checked: [] },
      category: ['danmark', 'europa', 'verden', 'sladder'].includes(parsed.category)
        ? parsed.category
        : sources[0].category || 'verden',
      sub_category: ['generelt', 'finans'].includes(parsed.sub_category)
        ? parsed.sub_category
        : sources[0].sub_category || 'generelt',
      interest_tags: Array.isArray(parsed.interest_tags) ? parsed.interest_tags : [],
      is_gossip: Boolean(parsed.is_gossip),
    };
  } catch (error) {
    clearTimeout(timeout);
    console.error('Article generation error:', error);
    return null;
  }
}

export async function GET() {
  try {
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

    if (!GROK_API_KEY) {
      return NextResponse.json({ error: 'GROK_API_KEY not configured' }, { status: 503 });
    }

    // Get unprocessed sources (last 24h, max 50)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rawSources, error: fetchError } = await supabase
      .from('raw_sources')
      .select('*')
      .eq('processed', false)
      .gte('fetched_at', oneDayAgo)
      .order('fetched_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error('Fetch raw_sources error:', fetchError);
      return NextResponse.json(
        { error: 'Database error', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!rawSources || rawSources.length === 0) {
      return NextResponse.json({ generated: 0, message: 'No unprocessed sources' });
    }

    // Group related sources
    const groups = groupSources(rawSources as RawSource[]);
    const articlesGenerated: string[] = [];
    const errors: string[] = [];

    // Generate articles (max 10 per run to stay within time limits)
    const maxArticles = Math.min(groups.length, 10);

    for (let i = 0; i < maxArticles; i++) {
      const group = groups[i];

      try {
        const article = await generateArticle(group);
        if (!article || !article.body || article.body.length < 50) {
          errors.push(`Group ${i}: generation returned empty/short article`);
          continue;
        }

        // Insert article
        const { error: insertError } = await supabase
          .from('articles')
          .insert({
            title: article.title,
            summary: article.summary,
            body: article.body,
            category: article.category,
            sub_category: article.sub_category,
            fact_score: article.fact_score,
            fact_details: article.fact_details,
            interest_tags: article.interest_tags,
            sources: group.map(s => ({
              title: s.title,
              url: s.url,
              source_name: s.source_name,
            })),
            is_gossip: article.is_gossip,
            published: true,
          });

        if (insertError) {
          errors.push(`Group ${i}: insert error - ${insertError.message}`);
          continue;
        }

        articlesGenerated.push(article.title);

        // Mark sources as processed
        const sourceIds = group.map(s => s.id);
        await supabase
          .from('raw_sources')
          .update({ processed: true })
          .in('id', sourceIds);
      } catch (err) {
        errors.push(`Group ${i}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    return NextResponse.json({
      generated: articlesGenerated.length,
      total_groups: groups.length,
      processed_groups: maxArticles,
      articles: articlesGenerated,
      errors: errors.length > 0 ? errors : undefined,
      raw_sources_count: rawSources.length,
    });
  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate articles', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
