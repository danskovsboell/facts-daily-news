/**
 * Test script: Grok News Discovery via xAI Responses API
 * 
 * Tester om Grok med web_search kan bruges til at FINDE nyheder
 * i stedet for (eller som supplement til) RSS/NewsAPI/Mediastack.
 * 
 * Kør med: npx tsx scripts/test-grok-news-discovery.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load env from .env.local or .env
const envCandidates = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
];
const envVars: Record<string, string> = {};
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) envVars[match[1].trim()] = match[2].trim();
    }
  }
}

const GROK_API_KEY = envVars.GROK_API_KEY || process.env.GROK_API_KEY;
const RESPONSES_API_URL = 'https://api.x.ai/v1/responses';
const MODEL = 'grok-4-1-fast-non-reasoning'; // Kræves til server-side tools

if (!GROK_API_KEY) {
  console.error('❌ GROK_API_KEY mangler i .env');
  process.exit(1);
}

// ============================================================
// Types
// ============================================================
interface GrokNewsStory {
  title: string;
  source: string;
  url: string;
  summary: string;
  category?: string;
}

interface SearchResult {
  query: string;
  category: string;
  stories: GrokNewsStory[];
  searchCalls: number;
  citations: string[];
  inputTokens: number;
  outputTokens: number;
  costUsdTicks: number;
  durationMs: number;
  error?: string;
}

interface TestResults {
  timestamp: string;
  model: string;
  totalSearches: number;
  totalStories: number;
  totalCost: number;
  totalDurationMs: number;
  results: SearchResult[];
}

// ============================================================
// Grok Web Search via Responses API
// ============================================================
async function searchNews(
  prompt: string,
  category: string,
  queryLabel: string
): Promise<SearchResult> {
  const start = Date.now();

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
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText}`);
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
    const cleaned = textContent.replace(/<grok:render[^]*?<\/grok:render>/g, '');
    let stories: GrokNewsStory[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      stories = parsed.stories || parsed.results || [];
    } catch {
      // Try to extract stories from non-JSON response
      console.warn(`  ⚠️  Kunne ikke parse JSON for "${queryLabel}", forsøger fallback...`);
      stories = [];
    }

    return {
      query: queryLabel,
      category,
      stories,
      searchCalls,
      citations,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      costUsdTicks: data.usage?.cost_in_usd_ticks || 0,
      durationMs,
    };
  } catch (error) {
    return {
      query: queryLabel,
      category,
      stories: [],
      searchCalls: 0,
      citations: [],
      inputTokens: 0,
      outputTokens: 0,
      costUsdTicks: 0,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================
// Test Queries
// ============================================================
const SEARCH_QUERIES = [
  {
    label: 'Danmark - Generelt',
    category: 'danmark',
    prompt: `Search the web for the most important Danish news stories from today. Find REAL current news from Danish media (DR, TV2, Berlingske, Politiken, Jyllands-Posten, etc).

Return ONLY valid JSON (no markdown, no extra text):
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence summary", "category": "danmark"}]}

Find 5-8 stories. Include the actual URL from the source.`,
  },
  {
    label: 'Danmark - Finans',
    category: 'danmark',
    prompt: `Search the web for today's Danish financial and business news. Look at Børsen, Berlingske Business, Finans.dk, and international sources covering Danish companies (Novo Nordisk, Maersk, Vestas, Carlsberg, etc).

Return ONLY valid JSON:
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence", "category": "finans"}]}

Find 5-8 stories.`,
  },
  {
    label: 'Europa - Generelt',
    category: 'europa',
    prompt: `Search the web for the most important European news from today (exclude Denmark-specific). Include EU politics, major events in European countries.

Return ONLY valid JSON:
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence", "category": "europa"}]}

Find 5-8 stories.`,
  },
  {
    label: 'Verden - Generelt',
    category: 'verden',
    prompt: `Search the web for today's most important world news (global, non-European). Include US, Asia, Middle East, Africa.

Return ONLY valid JSON:
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence", "category": "verden"}]}

Find 5-8 stories.`,
  },
  {
    label: 'Interesser: Tesla, AI, Grøn Energi',
    category: 'verden',
    prompt: `Search the web for today's latest news about: Tesla, Artificial Intelligence, and Green Energy / renewable energy.

Return ONLY valid JSON:
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence", "category": "tech/energy"}]}

Find 5-8 stories.`,
  },
];

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('🔍 Grok News Discovery Test');
  console.log(`📡 Model: ${MODEL}`);
  console.log(`📅 Dato: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  const results: SearchResult[] = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`\n🔎 Søger: ${query.label}...`);
    const result = await searchNews(query.prompt, query.category, query.label);

    if (result.error) {
      console.log(`  ❌ Fejl: ${result.error}`);
    } else {
      console.log(`  ✅ ${result.stories.length} nyheder fundet`);
      console.log(`  🔍 ${result.searchCalls} web-søgninger udført`);
      console.log(`  📎 ${result.citations.length} citationer`);
      console.log(`  💰 Pris: $${(result.costUsdTicks / 1_000_000).toFixed(4)}`);
      console.log(`  ⏱️  ${(result.durationMs / 1000).toFixed(1)}s`);

      for (const story of result.stories.slice(0, 5)) {
        console.log(`    📰 ${story.title}`);
        console.log(`       ${story.source} → ${story.url}`);
      }
      if (result.stories.length > 5) {
        console.log(`    ... og ${result.stories.length - 5} mere`);
      }
    }

    results.push(result);
  }

  // Summary
  const totalStories = results.reduce((sum, r) => sum + r.stories.length, 0);
  const totalCost = results.reduce((sum, r) => sum + r.costUsdTicks, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  const totalSearches = results.reduce((sum, r) => sum + r.searchCalls, 0);

  console.log('\n' + '═'.repeat(60));
  console.log('📊 OPSUMMERING');
  console.log('═'.repeat(60));
  console.log(`  📰 Total nyheder fundet: ${totalStories}`);
  console.log(`  🔍 Total web-søgninger: ${totalSearches}`);
  console.log(`  💰 Total pris: $${(totalCost / 1_000_000).toFixed(4)}`);
  console.log(`  ⏱️  Total tid: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  📊 Pris per nyhed: $${totalStories ? (totalCost / 1_000_000 / totalStories).toFixed(4) : 'N/A'}`);
  console.log(`  📊 Pris per søgning: $${(totalCost / 1_000_000 / SEARCH_QUERIES.length).toFixed(4)}`);

  // Save results
  const testResults: TestResults = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    totalSearches,
    totalStories,
    totalCost: totalCost / 1_000_000,
    totalDurationMs: totalDuration,
    results,
  };

  const outputDir = path.resolve(__dirname, '../test-results');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, `grok-news-discovery-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Resultater gemt i: ${outputFile}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
