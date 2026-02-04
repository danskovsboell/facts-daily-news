/**
 * Grok Web Search - Primary news discovery via xAI Responses API
 * 
 * Uses grok-4-1-fast-non-reasoning with web_search tool to discover
 * real-time news across categories and interest areas.
 */

const GROK_API_KEY = process.env.GROK_API_KEY;
const RESPONSES_API_URL = 'https://api.x.ai/v1/responses';
const MODEL = 'grok-4-1-fast-non-reasoning';

// ============================================================
// Types
// ============================================================
export interface GrokNewsStory {
  title: string;
  source: string;
  url: string;
  summary: string;
  category: string;
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

// ============================================================
// Search queries - categories + interests
// ============================================================
const SEARCH_QUERIES = [
  {
    label: 'Danmark - Generelt',
    category: 'danmark',
    subCategory: 'generelt',
    prompt: `Search the web for the most important Danish news stories from today. Find REAL current news from Danish media (DR, TV2, Berlingske, Politiken, Jyllands-Posten, BT, Ekstra Bladet, Information, etc).

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence summary in Danish", "category": "danmark"}]}

Find 8-12 stories. Include the actual URL from the source. Each story must have a unique URL.`,
  },
  {
    label: 'Danmark - Finans & Erhverv',
    category: 'danmark',
    subCategory: 'finans',
    prompt: `Search the web for today's Danish financial, business and economic news. Look at Børsen, Berlingske Business, Finans.dk, and international sources covering Danish companies (Novo Nordisk, Maersk, Vestas, Carlsberg, DSV, Ørsted, Pandora, etc). Also look for news about Danish economy, housing market, interest rates.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "danmark"}]}

Find 5-8 stories.`,
  },
  {
    label: 'Europa - Generelt',
    category: 'europa',
    subCategory: 'generelt',
    prompt: `Search the web for the most important European news from today (exclude Denmark-specific news). Include EU politics, major events in European countries (Germany, France, UK, Sweden, Norway, Italy, Spain, Poland, Ukraine, etc).

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "europa"}]}

Find 6-10 stories.`,
  },
  {
    label: 'Verden - Generelt',
    category: 'verden',
    subCategory: 'generelt',
    prompt: `Search the web for today's most important world news (global, non-European). Include USA, Asia, Middle East, Africa, Latin America. Cover geopolitics, conflicts, major events.

Return ONLY valid JSON (no markdown, no extra text, no grok:render tags):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "verden"}]}

Find 6-10 stories.`,
  },
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

// ============================================================
// Core: Search news via Grok Responses API with web_search
// ============================================================
async function searchNews(
  prompt: string,
  category: string,
  queryLabel: string,
  timeoutMs: number = 30000
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
    const cleaned = textContent.replace(/<grok:render[^]*?<\/grok:render>/g, '').trim();
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
      stories = stories.filter(s => s.title && s.url && s.summary);
    } catch {
      console.warn(`⚠️ Could not parse JSON for "${queryLabel}", trying line-by-line extraction...`);
      
      // Try to find JSON object in the text
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
          stories = parsed.stories || parsed.results || [];
          stories = stories.filter((s: GrokNewsStory) => s.title && s.url && s.summary);
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
// Main export: Discover all news via Grok web search
// ============================================================
export async function discoverNewsViaGrok(): Promise<{
  stories: GrokNewsStory[];
  results: GrokSearchResult[];
  totalSearches: number;
  totalDurationMs: number;
  errors: string[];
}> {
  const start = Date.now();
  const errors: string[] = [];

  // Run all searches in parallel for speed
  const results = await Promise.all(
    SEARCH_QUERIES.map(query =>
      searchNews(query.prompt, query.category, query.label, 45000)
    )
  );

  // Collect all stories, dedup by URL
  const seenUrls = new Set<string>();
  const allStories: GrokNewsStory[] = [];

  for (const result of results) {
    if (result.error) {
      errors.push(`${result.query}: ${result.error}`);
      continue;
    }

    for (const story of result.stories) {
      const urlKey = story.url?.toLowerCase().replace(/\/$/, '');
      if (urlKey && !seenUrls.has(urlKey)) {
        seenUrls.add(urlKey);
        
        // Map the search query category to the story
        const queryDef = SEARCH_QUERIES.find(q => q.label === result.query);
        if (queryDef) {
          story.category = queryDef.category;
        }
        
        allStories.push(story);
      }
    }
  }

  const totalSearches = results.reduce((sum, r) => sum + r.searchCalls, 0);
  const totalDurationMs = Date.now() - start;

  console.log(`🔍 Grok News Discovery: ${allStories.length} unique stories from ${results.length} searches (${totalSearches} web searches) in ${(totalDurationMs / 1000).toFixed(1)}s`);
  if (errors.length > 0) {
    console.warn(`⚠️ Grok search errors: ${errors.join(', ')}`);
  }

  return {
    stories: allStories,
    results,
    totalSearches,
    totalDurationMs,
    errors,
  };
}

// ============================================================
// Export search queries for testing/debugging
// ============================================================
export { SEARCH_QUERIES };
