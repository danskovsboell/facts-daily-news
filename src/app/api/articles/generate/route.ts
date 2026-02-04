import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { RawSource } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro plan

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const ARTICLE_MODEL = 'grok-3-mini';

// Batch config: process small batches per cron invocation
const MAX_SOURCES_PER_RUN = 25;
const MAX_ARTICLES_PER_RUN = 5;

// ─── Dedup helpers ───────────────────────────────────────────

/** Normalize a title for fuzzy comparison */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zæøåäöü0-9\s]/g, '') // keep letters/digits
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract significant words (>3 chars) from a title */
function significantWords(title: string): Set<string> {
  // Common Danish/English stop words to ignore
  const stopWords = new Set([
    'efter', 'over', 'under', 'med', 'uden', 'ikke', 'denne', 'dette',
    'disse', 'mere', 'mest', 'andre', 'andet', 'mange', 'nogle',
    'skal', 'ville', 'have', 'være', 'blev', 'bliver', 'også',
    'eller', 'when', 'what', 'that', 'this', 'with', 'from',
    'they', 'their', 'about', 'than', 'will', 'been', 'have',
    'just', 'more', 'some', 'other', 'into', 'could',
  ]);
  return new Set(
    normalizeTitle(title)
      .split(' ')
      .filter(w => w.length > 3 && !stopWords.has(w))
  );
}

/** Jaccard similarity between two sets of words (0-1) */
function titleSimilarity(a: string, b: string): number {
  const setA = significantWords(a);
  const setB = significantWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Check if a title is too similar to any existing article title */
function isDuplicate(newTitle: string, existingTitles: string[]): { isDup: boolean; matchedTitle?: string; similarity?: number } {
  const normNew = normalizeTitle(newTitle);
  for (const existing of existingTitles) {
    const normExisting = normalizeTitle(existing);

    // Exact match after normalization
    if (normNew === normExisting) {
      return { isDup: true, matchedTitle: existing, similarity: 1.0 };
    }

    // Fuzzy match: Jaccard similarity > 0.6
    const sim = titleSimilarity(newTitle, existing);
    if (sim > 0.6) {
      return { isDup: true, matchedTitle: existing, similarity: sim };
    }
  }
  return { isDup: false };
}

// ─── Source grouping ─────────────────────────────────────────

function groupSources(sources: RawSource[]): RawSource[][] {
  const groups: RawSource[][] = [];
  const used = new Set<string>();

  for (const source of sources) {
    if (used.has(source.id)) continue;

    const group = [source];
    used.add(source.id);

    const titleWords = significantWords(source.title);

    for (const other of sources) {
      if (used.has(other.id)) continue;
      if (other.category !== source.category) continue;

      const otherWords = significantWords(other.title);
      let overlap = 0;
      for (const w of otherWords) {
        if (titleWords.has(w)) overlap++;
      }

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

// ─── Article generation ──────────────────────────────────────

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
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s per article (Pro plan gives us room)

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

// ─── Main handler ────────────────────────────────────────────

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

    // ── Step 1: Fetch unprocessed sources (small batch) ──────
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rawSources, error: fetchError } = await supabase
      .from('raw_sources')
      .select('*')
      .eq('processed', false)
      .gte('fetched_at', oneDayAgo)
      .order('fetched_at', { ascending: false })
      .limit(MAX_SOURCES_PER_RUN);

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

    // ── Step 2: Load existing article titles for dedup ───────
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('title')
      .gte('created_at', twoDaysAgo);

    const existingTitles: string[] = (existingArticles || []).map((a: { title: string }) => a.title);

    // Also check existing source URLs to avoid regenerating from same source
    const { data: existingSourceUrls } = await supabase
      .from('articles')
      .select('sources')
      .gte('created_at', twoDaysAgo);

    const usedSourceUrls = new Set<string>();
    for (const article of existingSourceUrls || []) {
      if (Array.isArray(article.sources)) {
        for (const src of article.sources) {
          if (src.url) usedSourceUrls.add(src.url.toLowerCase());
        }
      }
    }

    // ── Step 3: Filter out sources whose URLs are already used ─
    const freshSources = (rawSources as RawSource[]).filter(s => {
      const urlUsed = usedSourceUrls.has(s.url.toLowerCase());
      if (urlUsed) {
        // Mark as processed silently since we already have an article from this source
        supabase
          .from('raw_sources')
          .update({ processed: true })
          .eq('id', s.id)
          .then(() => {});
      }
      return !urlUsed;
    });

    if (freshSources.length === 0) {
      // Mark remaining as processed anyway
      const ids = (rawSources as RawSource[]).map(s => s.id);
      await supabase.from('raw_sources').update({ processed: true }).in('id', ids);
      return NextResponse.json({
        generated: 0,
        message: 'All sources already covered by existing articles',
        skipped_duplicate_sources: rawSources.length,
      });
    }

    // ── Step 4: Group related sources ────────────────────────
    const groups = groupSources(freshSources);
    const articlesGenerated: string[] = [];
    const skippedDuplicates: string[] = [];
    const errors: string[] = [];

    // ── Step 5: Generate articles (max per run) ──────────────
    let articlesCreated = 0;

    for (let i = 0; i < groups.length && articlesCreated < MAX_ARTICLES_PER_RUN; i++) {
      const group = groups[i];

      try {
        // Pre-check: would the primary source title be a duplicate?
        const primaryTitle = group[0].title;
        const dupCheck = isDuplicate(primaryTitle, existingTitles);
        if (dupCheck.isDup) {
          skippedDuplicates.push(
            `"${primaryTitle}" ≈ "${dupCheck.matchedTitle}" (${Math.round((dupCheck.similarity || 0) * 100)}%)`
          );
          // Mark sources as processed so we don't retry
          const sourceIds = group.map(s => s.id);
          await supabase.from('raw_sources').update({ processed: true }).in('id', sourceIds);
          continue;
        }

        const article = await generateArticle(group);
        if (!article || !article.body || article.body.length < 50) {
          errors.push(`Group ${i}: generation returned empty/short article`);
          // Still mark as processed to avoid retrying bad sources
          const sourceIds = group.map(s => s.id);
          await supabase.from('raw_sources').update({ processed: true }).in('id', sourceIds);
          continue;
        }

        // Post-check: is the generated title a duplicate?
        const genDupCheck = isDuplicate(article.title, existingTitles);
        if (genDupCheck.isDup) {
          skippedDuplicates.push(
            `Generated "${article.title}" ≈ "${genDupCheck.matchedTitle}" (${Math.round((genDupCheck.similarity || 0) * 100)}%)`
          );
          const sourceIds = group.map(s => s.id);
          await supabase.from('raw_sources').update({ processed: true }).in('id', sourceIds);
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
        existingTitles.push(article.title); // Add to dedup list for this run
        articlesCreated++;

        // Mark sources as processed
        const sourceIds = group.map(s => s.id);
        await supabase
          .from('raw_sources')
          .update({ processed: true })
          .in('id', sourceIds);
      } catch (err) {
        errors.push(`Group ${i}: ${err instanceof Error ? err.message : 'unknown error'}`);
        // Mark as processed to prevent infinite retry loops
        const sourceIds = group.map(s => s.id);
        await supabase.from('raw_sources').update({ processed: true }).in('id', sourceIds);
      }
    }

    return NextResponse.json({
      generated: articlesGenerated.length,
      total_groups: groups.length,
      processed_groups: Math.min(groups.length, MAX_ARTICLES_PER_RUN + skippedDuplicates.length),
      articles: articlesGenerated,
      skipped_duplicates: skippedDuplicates.length > 0 ? skippedDuplicates : undefined,
      errors: errors.length > 0 ? errors : undefined,
      raw_sources_count: rawSources.length,
      fresh_sources_count: freshSources.length,
    });
  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate articles', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
