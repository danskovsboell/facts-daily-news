import { FactCheckResult, Category, SubCategory, GrokCategorizationResult } from './types';

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

// Models
const FAST_MODEL = 'grok-3-mini-fast'; // Hurtig + billig til kategorisering
const QUALITY_MODEL = 'grok-3-mini';   // Bedre kvalitet til fakta-check

// ============================================================
// In-memory cache for fact-check results
// ============================================================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const factCheckCache = new Map<string, CacheEntry<FactCheckResult>>();
const categorizeCache = new Map<string, CacheEntry<GrokCategorizationResult>>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutter

function getCacheKey(title: string, source?: string): string {
  return `${title.toLowerCase().trim()}::${source || ''}`;
}

function getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
  // Rens gammel cache (max 500 entries)
  if (cache.size > 500) {
    const oldest = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 100);
    for (const [k] of oldest) cache.delete(k);
  }
}

// ============================================================
// Helper: Call Grok API
// ============================================================
async function callGrok(
  model: string,
  systemPrompt: string,
  userMessage: string,
  temperature: number = 0.3,
  timeoutMs: number = 25000
): Promise<string> {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      response_format: { type: 'json_object' },
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Grok API error (${response.status}):`, errorText);
    throw new Error(`Grok API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]?.message?.content) {
    throw new Error('Unexpected Grok API response format');
  }

  return data.choices[0].message.content;
}

// ============================================================
// Fact-check a news article using Grok
// ============================================================
export async function factCheck(
  title: string,
  content: string,
  source: string
): Promise<FactCheckResult> {
  // Check cache first
  const cacheKey = getCacheKey(title, source);
  const cached = getFromCache(factCheckCache, cacheKey);
  if (cached) {
    return cached;
  }

  if (!GROK_API_KEY) {
    return {
      score: -1,
      summary: 'Fakta-check ikke tilgængelig – GROK_API_KEY mangler',
      claims: [],
      sources: [],
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const systemPrompt = `Du er en erfaren fakta-checker og journalist. Analysér følgende nyhedsartikel og vurder dens troværdighed.

Du SKAL returnere et JSON-objekt med PRÆCIS dette format:
{
  "score": <number 0-100, troværdighedsscore>,
  "summary": "<kort dansk opsummering af din vurdering, 1-2 sætninger>",
  "category": "<en af: Generelt, Finans & Business, Sludder & Sladder>",
  "claims": [
    {
      "text": "<den specifikke påstand>",
      "verdict": "<true|mostly-true|mixed|mostly-false|false|unverified>",
      "explanation": "<kort forklaring på dansk>"
    }
  ],
  "sources": ["<kilde 1>", "<kilde 2>"]
}

Scoring-guide:
- 85-100: Veldokumenteret, fra troværdig kilde, faktuelle påstande verificerbare
- 70-84: Generelt korrekt, men mangler nuancer eller kilder
- 50-69: Blandet - indeholder både korrekte og tvivlsomme påstande
- 30-49: Vildledende eller ensidigt vinklet
- 0-29: Misinformation eller stærkt fejlagtigt

Vær fair men kritisk. Danske medier som DR, TV2, Berlingske, Politiken er generelt troværdige.
Giv altid mindst 1-2 claims.
Kilder skal være rigtige referencer (nyhedsmedier, officielle organer osv).`;

    const userMessage = `Kilde: ${source}\nOverskrift: ${title}\n\nIndhold: ${content || '(kun overskrift tilgængelig)'}`;

    const responseText = await callGrok(QUALITY_MODEL, systemPrompt, userMessage, 0.3, 30000);
    const result = JSON.parse(responseText);

    const factResult: FactCheckResult = {
      score: Math.min(100, Math.max(0, Number(result.score) || 50)),
      summary: result.summary || 'Ingen vurdering tilgængelig',
      claims: Array.isArray(result.claims) ? result.claims.map((c: { text?: string; verdict?: string; explanation?: string }) => ({
        text: c.text || '',
        verdict: ['true', 'mostly-true', 'mixed', 'mostly-false', 'false', 'unverified'].includes(c.verdict || '')
          ? c.verdict
          : 'unverified',
        explanation: c.explanation || '',
      })) : [],
      sources: Array.isArray(result.sources) ? result.sources : [],
      category: result.category || 'Generelt',
      checkedAt: new Date().toISOString(),
    };

    // Cache the result
    setCache(factCheckCache, cacheKey, factResult);

    return factResult;
  } catch (error) {
    console.error('Grok fact-check error:', error);
    return {
      score: -1,
      summary: `Fejl ved fakta-check: ${error instanceof Error ? error.message : 'ukendt fejl'}`,
      claims: [],
      sources: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

// ============================================================
// Categorize a news article using Grok
// ============================================================
export async function categorize(
  title: string,
  content: string
): Promise<GrokCategorizationResult> {
  // Check cache
  const cacheKey = getCacheKey(title);
  const cached = getFromCache(categorizeCache, cacheKey);
  if (cached) {
    return cached;
  }

  if (!GROK_API_KEY) {
    return {
      category: 'verden',
      subCategory: 'generelt',
      region: 'unknown',
      isGossip: false,
      confidence: 0,
    };
  }

  try {
    const systemPrompt = `Du er en nyhedskategoriserings-ekspert. Kategorisér denne nyhed.

Returnér et JSON-objekt med PRÆCIS dette format:
{
  "category": "<danmark|europa|verden|sladder>",
  "subCategory": "<generelt|finans>",
  "region": "<specifik region/land, f.eks. 'Danmark', 'USA', 'EU'>",
  "isGossip": <true|false>,
  "confidence": <number 0-100>
}

Kategori-regler:
- "danmark": Nyheder om Danmark, danske personer, dansk politik, danske virksomheder
- "europa": Nyheder om europæiske lande (undtagen Danmark), EU, europæisk politik
- "verden": Nyheder om resten af verden, globale emner
- "sladder": Kendisnyheder, gossip, underholdning, reality TV, royalt sladder, kuriositeter

SubCategory-regler:
- "finans": Økonomi, aktier, valuta, virksomhedsnyheder, handelsnyheder, renter, boligmarked
- "generelt": Alt andet

isGossip = true for: kendisnyheder, underholdning, reality, sladder, kuriositeter, sport-gossip`;

    const userMessage = `${title}\n\n${content || ''}`.slice(0, 1000);

    const responseText = await callGrok(FAST_MODEL, systemPrompt, userMessage, 0.2);
    const result = JSON.parse(responseText);

    const catResult: GrokCategorizationResult = {
      category: ['danmark', 'europa', 'verden', 'sladder'].includes(result.category)
        ? result.category as Category
        : 'verden',
      subCategory: ['generelt', 'finans'].includes(result.subCategory)
        ? result.subCategory as SubCategory
        : 'generelt',
      region: result.region || 'unknown',
      isGossip: Boolean(result.isGossip),
      confidence: Math.min(100, Math.max(0, Number(result.confidence) || 50)),
    };

    // Cache
    setCache(categorizeCache, cacheKey, catResult);

    return catResult;
  } catch (error) {
    console.error('Grok categorize error:', error);
    return {
      category: 'verden',
      subCategory: 'generelt',
      region: 'unknown',
      isGossip: false,
      confidence: 0,
    };
  }
}

// ============================================================
// Batch categorize multiple news items (efficient)
// ============================================================
export async function batchCategorize(
  items: { title: string; content?: string }[]
): Promise<GrokCategorizationResult[]> {
  if (!GROK_API_KEY || items.length === 0) {
    return items.map(() => ({
      category: 'verden' as Category,
      subCategory: 'generelt' as SubCategory,
      region: 'unknown',
      isGossip: false,
      confidence: 0,
    }));
  }

  try {
    const systemPrompt = `Kategorisér disse nyhedsoverskrifter. Returnér JSON med et "results" array – ét element per overskrift, i SAMME rækkefølge.

Format: {"results":[{"category":"...", "subCategory":"...", "region":"...", "isGossip":false, "confidence":85}, ...]}

category (vælg ÉN):
• "danmark" – handler om Danmark, danske personer/virksomheder (Novo Nordisk, Mette Frederiksen, DR, danske byer osv.)
• "europa" – europæiske lande UNDTAGEN Danmark, EU-politik
• "verden" – USA, Asien, Mellemøsten, Afrika, globalt
• "sladder" – kendis, underholdning, reality, royalt sladder

subCategory: "finans" for økonomi/aktier/business/valuta/renter, ellers "generelt"
region: landet/området nyheden handler om (f.eks. "Danmark", "USA", "EU", "Kina")
isGossip: true KUN for underholdning/kendisnyheder
confidence: 70-95 for tydelige, 50-69 for tvetydige

VIGTIGT: Overskrifter på dansk handler OFTE om Danmark – check om de nævner danske emner!`;

    const numberedItems = items
      .map((item, i) => `${i + 1}. ${item.title}`)
      .join('\n');

    const responseText = await callGrok(FAST_MODEL, systemPrompt, numberedItems, 0.2);
    const parsed = JSON.parse(responseText);
    const results = parsed.results || parsed;

    if (!Array.isArray(results)) {
      throw new Error('Batch categorize returned non-array');
    }

    return results.map((r: { category?: string; subCategory?: string; region?: string; isGossip?: boolean; confidence?: number }) => ({
      category: ['danmark', 'europa', 'verden', 'sladder'].includes(r.category || '')
        ? r.category as Category
        : 'verden',
      subCategory: ['generelt', 'finans'].includes(r.subCategory || '')
        ? r.subCategory as SubCategory
        : 'generelt',
      region: r.region || 'unknown',
      isGossip: Boolean(r.isGossip),
      confidence: Math.min(100, Math.max(0, Number(r.confidence) || 50)),
    }));
  } catch (error) {
    console.error('Grok batch categorize error:', error);
    return items.map(() => ({
      category: 'verden' as Category,
      subCategory: 'generelt' as SubCategory,
      region: 'unknown',
      isGossip: false,
      confidence: 0,
    }));
  }
}

// ============================================================
// Search X (Twitter) for related posts using Grok
// ============================================================
export async function searchX(query: string): Promise<string[]> {
  if (!GROK_API_KEY) {
    return [];
  }

  try {
    const systemPrompt = `Du har adgang til information fra X/Twitter. Find relevante og nylige diskussioner om det givne emne.

Returnér et JSON-objekt med dette format:
{
  "posts": [
    "<Kort beskrivelse af relevant X-post eller trend>",
    "<Kort beskrivelse af relevant X-post eller trend>"
  ]
}

Returnér 3-5 relevante poster/trends. Vær specifik og inkluder brugernavne hvis muligt.`;

    const responseText = await callGrok(FAST_MODEL, systemPrompt, query, 0.5);
    const parsed = JSON.parse(responseText);
    return Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch (error) {
    console.error('Grok X search error:', error);
    return [];
  }
}

// ============================================================
// Quick fact-check (lighter version for batch processing)
// ============================================================
export async function quickFactCheck(
  title: string,
  source: string
): Promise<{ score: number; summary: string }> {
  // Check cache
  const cacheKey = getCacheKey(title, source);
  const cached = getFromCache(factCheckCache, cacheKey);
  if (cached) {
    return { score: cached.score, summary: cached.summary };
  }

  if (!GROK_API_KEY) {
    return { score: -1, summary: 'API nøgle mangler' };
  }

  try {
    const systemPrompt = `Du er en hurtig fakta-vurderer. Giv en troværdighedsscore baseret på overskrift og kilde.

Returnér JSON: { "score": <0-100>, "summary": "<1 sætning på dansk>" }

Quick-guide:
- Kendte troværdige medier (DR, BBC, Reuters, AP): 80-95
- Større aviser (Berlingske, Politiken, Guardian): 75-90
- Tabloid/sladder-medier: 40-65
- Ukendt kilde: 50-60
Justér score baseret på om overskriften virker sensationel, faktuel, eller vildledende.`;

    const responseText = await callGrok(FAST_MODEL, systemPrompt, `Kilde: ${source}\nOverskrift: ${title}`, 0.2);
    const result = JSON.parse(responseText);

    return {
      score: Math.min(100, Math.max(0, Number(result.score) || 50)),
      summary: result.summary || '',
    };
  } catch (error) {
    console.error('Quick fact-check error:', error);
    return { score: -1, summary: 'Fejl' };
  }
}

// ============================================================
// Export cache stats (for debugging)
// ============================================================
export function getCacheStats() {
  return {
    factCheckCacheSize: factCheckCache.size,
    categorizeCacheSize: categorizeCache.size,
  };
}
