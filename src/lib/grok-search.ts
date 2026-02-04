/**
 * Grok Web Search - Primary news discovery via xAI Responses API
 *
 * Uses grok-4-1-fast-non-reasoning with web_search tool to discover
 * real-time news across categories and interest areas.
 *
 * Search topics are driven by the Supabase `interests` table:
 *   - Core geographic searches (Danmark, Europa, Verden) always run
 *   - Interest-based searches come from DB (with hardcoded fallback)
 */

import { getSupabase } from '@/lib/supabase';

const GROK_API_KEY = process.env.GROK_API_KEY;
const RESPONSES_API_URL = 'https://api.x.ai/v1/responses';
const MODEL = 'grok-4-1-fast-non-reasoning';
const MAX_INTEREST_SEARCHES = 20;

// ============================================================
// Types
// ============================================================
export interface GrokNewsStory {
  title: string;
  source: string;
  url: string;
  summary: string;
  category: string;
  published_date?: string;
}

export interface GrokSearchResult {
  query: string;
  category: string;
  stories: GrokNewsStory[];
  searchCalls: number;
  citations: string[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  error?: string;
}

interface SearchQuery {
  label: string;
  category: string;
  subCategory: string;
  prompt: string;
}

// ============================================================
// Core geographic searches — always run, not interest-driven
// ============================================================
const CORE_GEO_SEARCHES: SearchQuery[] = [
  {
    label: 'Danmark - Generelt',
    category: 'danmark',
    subCategory: 'generelt',
    prompt: `Search the web for the most important Danish news stories from today. Find REAL current news from Danish media (DR, TV2, Berlingske, Politiken, Jyllands-Posten, BT, Ekstra Bladet, Information, etc).

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence summary in Danish", "category": "danmark", "published_date": "ISO 8601 datetime of when this news was published/happened"}]}

Find 8-12 stories. Include the actual URL from the source. Each story must have a unique URL. published_date should be as precise as possible (include time if known).`,
  },
  {
    label: 'Danmark - Finans & Erhverv',
    category: 'danmark',
    subCategory: 'finans',
    prompt: `Search the web for today's Danish financial, business and economic news. Look at Børsen, Berlingske Business, Finans.dk, and international sources covering Danish companies (Novo Nordisk, Maersk, Vestas, Carlsberg, DSV, Ørsted, Pandora, etc). Also look for news about Danish economy, housing market, interest rates.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "danmark", "published_date": "ISO 8601 datetime of when this news was published/happened"}]}

Find 5-8 stories. published_date should be as precise as possible.`,
  },
  {
    label: 'Europa - Generelt',
    category: 'europa',
    subCategory: 'generelt',
    prompt: `Search the web for the most important European news from today (exclude Denmark-specific news). Include EU politics, major events in European countries (Germany, France, UK, Sweden, Norway, Italy, Spain, Poland, Ukraine, etc).

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "europa", "published_date": "ISO 8601 datetime of when this news was published/happened"}]}

Find 6-10 stories. published_date should be as precise as possible.`,
  },
  {
    label: 'Verden - Generelt',
    category: 'verden',
    subCategory: 'generelt',
    prompt: `Search the web for today's most important world news (global, non-European). Include USA, Asia, Middle East, Africa, Latin America. Cover geopolitics, conflicts, major events.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "verden", "published_date": "ISO 8601 datetime of when this news was published/happened"}]}

Find 6-10 stories. published_date should be as precise as possible.`,
  },
];

// ============================================================
// Fallback interest searches — used only when DB is unavailable
// ============================================================
const FALLBACK_INTEREST_SEARCHES: SearchQuery[] = [
  {
    label: 'Tesla & Elon Musk',
    category: 'verden',
    subCategory: 'generelt',
    prompt: `Search the web for today's latest news about Tesla, SpaceX, and Elon Musk. Include stock price movements, product news, regulatory developments, and any controversy.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "tesla"}]}

Find 3-6 stories.`,
  },
  {
    label: 'AI & Teknologi',
    category: 'verden',
    subCategory: 'generelt',
    prompt: `Search the web for today's latest news about Artificial Intelligence, Large Language Models, and tech industry. Include OpenAI, Google DeepMind, Anthropic, Meta AI, xAI, Microsoft, Apple, NVIDIA, and major AI developments.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "ai"}]}

Find 3-6 stories.`,
  },
  {
    label: 'Grøn Energi & Klima',
    category: 'verden',
    subCategory: 'generelt',
    prompt: `Search the web for today's latest news about green energy, renewable energy, climate change, electric vehicles, solar, wind power, hydrogen, batteries, and sustainability.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "groen_energi"}]}

Find 3-5 stories.`,
  },
  {
    label: 'Økonomi, Finans & Renter',
    category: 'verden',
    subCategory: 'finans',
    prompt: `Search the web for today's most important global financial news. Include stock markets, interest rates, central banks (ECB, Fed, Bank of England), inflation, bonds, currencies, major deals, and economic data.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "finans"}]}

Find 5-8 stories.`,
  },
];

// Combined fallback for backward compatibility export
const SEARCH_QUERIES = [...CORE_GEO_SEARCHES, ...FALLBACK_INTEREST_SEARCHES];

// ============================================================
// Interest category → article category mapping
// ============================================================
function mapInterestCategoryToArticle(interestCategory: string): string {
  switch (interestCategory) {
    case 'finans':
      return 'verden'; // will be re-categorized downstream
    case 'tech':
      return 'verden';
    case 'energi':
      return 'verden';
    case 'general':
      return 'verden';
    case 'custom':
      return 'verden';
    default:
      return 'verden';
  }
}

function mapInterestToSubCategory(interestCategory: string): string {
  return interestCategory === 'finans' ? 'finans' : 'generelt';
}

// ============================================================
// Core: Search news via Grok Responses API with web_search
// ============================================================
async function searchNews(
  prompt: string,
  category: string,
  queryLabel: string,
  timeoutMs: number = 30000,
): Promise<GrokSearchResult> {
  const start = Date.now();

  if (!GROK_API_KEY) {
    return {
      query: queryLabel,
      category,
      stories: [],
      searchCalls: 0,
      citations: [],
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      error: 'GROK_API_KEY not configured',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(RESPONSES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'web_search' as const,
          },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = await response.json();
    const durationMs = Date.now() - start;

    // Extract text content from output
    let textContent = '';
    let searchCalls = 0;
    const citations: string[] = [];

    for (const item of data.output || []) {
      if (item.type === 'web_search_call') {
        searchCalls++;
      }
      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.type === 'output_text') {
            textContent = part.text;
            if (part.annotations) {
              for (const ann of part.annotations) {
                if (ann.url) citations.push(ann.url);
              }
            }
          }
        }
      }
    }

    // Parse the JSON from text (strip grok:render tags first)
    const cleaned = textContent
      .replace(/<grok:render[^]*?<\/grok:render>/g, '')
      .trim();
    let stories: GrokNewsStory[] = [];

    try {
      // Try to extract JSON from response - may be wrapped in markdown code blocks
      let jsonStr = cleaned;

      // Remove markdown code block markers if present
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);
      stories = parsed.stories || parsed.results || [];

      // Validate stories have required fields
      stories = stories.filter((s) => s.title && s.url && s.summary);
    } catch {
      console.warn(
        `⚠️ Could not parse JSON for "${queryLabel}", trying line-by-line extraction...`,
      );

      // Try to find JSON object in the text
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
          stories = parsed.stories || parsed.results || [];
          stories = stories.filter(
            (s: GrokNewsStory) => s.title && s.url && s.summary,
          );
        } catch {
          console.error(`❌ Failed to parse any JSON for "${queryLabel}"`);
        }
      }
    }

    return {
      query: queryLabel,
      category,
      stories,
      searchCalls,
      citations,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      durationMs,
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      query: queryLabel,
      category,
      stories: [],
      searchCalls: 0,
      citations: [],
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================
// DB interest types
// ============================================================
interface DBInterest {
  id: string;
  name: string;
  slug: string;
  search_prompt: string | null;
  category: string;
  is_predefined: boolean;
  active_users: number;
}

// ============================================================
// Fetch interests from Supabase → build search queries
// ============================================================
async function getInterestSearchQueries(): Promise<SearchQuery[] | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, will use fallback interest searches');
      return null;
    }

    // Fetch ALL interests (predefined + custom) — søg nyheder for alle
    const { data, error } = await supabase
      .from('interests')
      .select('id, name, slug, search_prompt, category, is_predefined, active_users')
      .order('active_users', { ascending: false })
      .limit(MAX_INTEREST_SEARCHES);

    if (error) {
      console.error('❌ Error fetching interests from DB:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('ℹ️ No interests with active users found in DB, using fallback');
      return null;
    }

    const interests = data as DBInterest[];
    console.log(
      `📋 Loaded ${interests.length} interests from DB: ${interests.map((i) => i.name).join(', ')}`,
    );

    // Build search queries from interests
    return interests.map((interest) => {
      const articleCategory = mapInterestCategoryToArticle(interest.category);
      const subCategory = mapInterestToSubCategory(interest.category);
      const slug = interest.slug;

      // Use search_prompt if available, otherwise generate from name
      const searchTerms = interest.search_prompt || interest.name;
      const prompt = buildInterestPrompt(interest.name, searchTerms, slug);

      return {
        label: `Interest: ${interest.name}`,
        category: articleCategory,
        subCategory,
        prompt,
      };
    });
  } catch (err) {
    console.error('❌ Failed to fetch interests from DB:', err);
    return null;
  }
}

/** Build a Grok search prompt for a DB interest */
function buildInterestPrompt(
  name: string,
  searchTerms: string,
  slug: string,
): string {
  return `Search the web for today's latest news about ${name}. Use these search terms: ${searchTerms}. Find recent articles, developments, and updates from the last 24 hours.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "${slug}", "published_date": "ISO 8601 datetime of when this news was published/happened"}]}

Find 3-6 stories. Include the actual URL from the source. Each story must have a unique URL. published_date should be as precise as possible.`;
}

// ============================================================
// Main export: Discover all news via Grok web search
// ============================================================
export async function discoverNewsViaGrok(): Promise<{
  stories: GrokNewsStory[];
  results: GrokSearchResult[];
  totalSearches: number;
  totalDurationMs: number;
  errors: string[];
  customInterestCount: number;
  interestSource: 'database' | 'fallback';
}> {
  const start = Date.now();
  const errors: string[] = [];

  // ── Step 1: Fetch interest queries from DB (parallel with core geo) ──
  const [coreResults, dbInterestQueries] = await Promise.all([
    // Always run core geographic searches
    Promise.all(
      CORE_GEO_SEARCHES.map((query) =>
        searchNews(query.prompt, query.category, query.label, 45000),
      ),
    ),
    // Fetch interest search queries from DB
    getInterestSearchQueries(),
  ]);

  // ── Step 2: Determine interest searches to run ───────────
  const interestSource: 'database' | 'fallback' =
    dbInterestQueries && dbInterestQueries.length > 0 ? 'database' : 'fallback';

  const interestQueries: SearchQuery[] =
    interestSource === 'database'
      ? dbInterestQueries!
      : FALLBACK_INTEREST_SEARCHES;

  console.log(
    `🔍 Interest source: ${interestSource} (${interestQueries.length} searches)`,
  );

  // ── Step 3: Run interest searches in parallel ────────────
  const interestResults = await Promise.all(
    interestQueries.map((query) =>
      searchNews(query.prompt, query.category, query.label, 45000),
    ),
  );

  // ── Step 4: Combine and deduplicate ──────────────────────
  const allResults = [...coreResults, ...interestResults];

  const seenUrls = new Set<string>();
  const allStories: GrokNewsStory[] = [];

  for (const result of allResults) {
    if (result.error) {
      errors.push(`${result.query}: ${result.error}`);
      continue;
    }

    for (const story of result.stories) {
      const urlKey = story.url?.toLowerCase().replace(/\/$/, '');
      if (urlKey && !seenUrls.has(urlKey)) {
        seenUrls.add(urlKey);

        // Map the search query category to the story (for core geo queries)
        const coreQuery = CORE_GEO_SEARCHES.find(
          (q) => q.label === result.query,
        );
        if (coreQuery) {
          story.category = coreQuery.category;
        }
        // For interest searches, the category is already set by the prompt

        allStories.push(story);
      }
    }
  }

  const totalSearches = allResults.reduce(
    (sum, r) => sum + r.searchCalls,
    0,
  );
  const totalDurationMs = Date.now() - start;

  console.log(
    `🔍 Grok News Discovery: ${allStories.length} unique stories from ${allResults.length} searches ` +
      `(${coreResults.length} core + ${interestResults.length} interests [${interestSource}]) ` +
      `(${totalSearches} web searches) in ${(totalDurationMs / 1000).toFixed(1)}s`,
  );
  if (errors.length > 0) {
    console.warn(`⚠️ Grok search errors: ${errors.join(', ')}`);
  }

  return {
    stories: allStories,
    results: allResults,
    totalSearches,
    totalDurationMs,
    errors,
    customInterestCount: interestResults.length,
    interestSource,
  };
}

// ============================================================
// Single interest search (used by /api/trigger-search)
// ============================================================
export async function searchSingleInterest(
  interestName: string,
  searchPrompt?: string,
): Promise<GrokSearchResult> {
  const prompt = searchPrompt
    ? `${searchPrompt}\n\nReturn ONLY valid JSON (no markdown, no extra text, no grok:render tags):\n{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "custom"}]}\n\nFind 3-6 stories.`
    : `Search for today's latest news about ${interestName}. Find recent articles, developments, and updates.\n\nReturn ONLY valid JSON (no markdown, no extra text, no grok:render tags):\n{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "custom"}]}\n\nFind 3-6 stories.`;

  return searchNews(prompt, 'custom', `Instant: ${interestName}`, 45000);
}

// ============================================================
// Export for backward compatibility and testing/debugging
// ============================================================
export { SEARCH_QUERIES, CORE_GEO_SEARCHES, FALLBACK_INTEREST_SEARCHES };
