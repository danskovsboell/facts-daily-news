import { FactCheckResult, Category, SubCategory, GrokCategorizationResult, SourceLink, Claim } from './types';

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_RESPONSES_URL = 'https://api.x.ai/v1/responses';

// Models
const FAST_MODEL = 'grok-3-mini-fast'; // Hurtig + billig til kategorisering
const QUALITY_MODEL = 'grok-3-mini';   // Bedre kvalitet til fakta-check
const SEARCH_MODEL = 'grok-3-mini-fast'; // For web search verification

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
// Helper: Call Grok Responses API with web_search tool
// Returns text content + all citation URLs found
// ============================================================
async function callGrokWithWebSearch(
  prompt: string,
  timeoutMs: number = 30000
): Promise<{ text: string; citations: string[]; searchCalls: number }> {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GROK_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: SEARCH_MODEL,
        input: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search' as const }],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Grok Responses API ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = await response.json();

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
                if (ann.url && !citations.includes(ann.url)) {
                  citations.push(ann.url);
                }
              }
            }
          }
        }
      }
    }

    return { text: textContent, citations, searchCalls };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ============================================================
// Helper: Extract domain from URL
// ============================================================
function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ============================================================
// Fact-check a news article using a single Grok web search call
// One prompt does everything: identify claims, verify, score
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
      verificationMethod: 'ai-only',
    };
  }

  try {
    console.log(`🔍 Starting fact-check for: "${title.slice(0, 60)}..."`);

    const articleText = content
      ? `Overskrift: ${title}\nKilde: ${source}\n\nIndhold:\n${content}`
      : `Overskrift: ${title}\nKilde: ${source}`;

    const prompt = `Du er en professionel fakta-checker. Fakta-tjek følgende nyhedsartikel.

Brug websøgning til at verificere de vigtigste faktuelle påstande i artiklen. Identificer 3-5 konkrete, verificerbare påstande (tal, datoer, navne, begivenheder – IKKE meninger), og søg efter beviser for eller imod hver enkelt.

ARTIKEL:
${articleText}

Baseret på din research, svar med KUN valid JSON (ingen markdown, ingen ekstra tekst):
{
  "score": <0-100 samlet troværdighedsscore>,
  "summary": "<kort samlet vurdering på dansk, 1-3 sætninger>",
  "claims": [
    {
      "text": "<den specifikke påstand>",
      "verdict": "<true|mostly-true|mixed|mostly-false|false|unverified>",
      "explanation": "<kort forklaring på dansk af hvad du fandt>"
    }
  ]
}

Score-guide:
- 85-100: Alle nøglepåstande bekræftet af troværdige kilder
- 70-84: De fleste påstande bekræftet, mindre unøjagtigheder
- 50-69: Blandet – nogle påstande bekræftet, andre ikke
- 30-49: Væsentlige fejl eller vildledende indhold
- 0-29: Overvejende falsk eller misvisende

Verdict-guide:
- "true": Flere pålidelige kilder bekræfter
- "mostly-true": Bekræftet med mindre nuancer
- "mixed": Delvist korrekt, delvist forkert
- "mostly-false": Kernen er forkert selvom dele er sande
- "false": Modbevist af pålidelige kilder
- "unverified": Ikke nok evidens til at afgøre`;

    const { text, citations, searchCalls } = await callGrokWithWebSearch(prompt, 45000);

    // Parse JSON from response
    let jsonStr = text.trim();

    // Strip markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Find the JSON object
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // Build source links from citations
    const allSourceLinks: SourceLink[] = citations.map(url => ({
      url,
      domain: extractDomain(url),
      title: extractDomain(url),
    }));

    // Validate and build claims
    const validVerdicts = ['true', 'mostly-true', 'mixed', 'mostly-false', 'false', 'unverified'];
    const claims: Claim[] = Array.isArray(parsed.claims)
      ? parsed.claims.map((c: { text?: string; verdict?: string; explanation?: string }) => ({
          text: c.text || '',
          verdict: validVerdicts.includes(c.verdict || '') ? c.verdict as Claim['verdict'] : 'unverified',
          explanation: c.explanation || '',
          claimSources: allSourceLinks, // All citations shared across claims
        }))
      : [];

    const score = Math.min(100, Math.max(0, Number(parsed.score) || 50));
    const sourceNames = [...new Set(allSourceLinks.map(s => s.domain || extractDomain(s.url)))];

    const factResult: FactCheckResult = {
      score,
      summary: parsed.summary || 'Fakta-check gennemført via websøgning.',
      claims,
      sources: sourceNames,
      sourceLinks: allSourceLinks,
      sourcesConsulted: allSourceLinks.length,
      category: 'Generelt',
      checkedAt: new Date().toISOString(),
      verificationMethod: 'web-search',
    };

    console.log(`✅ Fact-check complete: score=${score}, claims=${claims.length}, sources=${allSourceLinks.length}, searches=${searchCalls}`);

    // Cache the result
    setCache(factCheckCache, cacheKey, factResult);

    return factResult;
  } catch (error) {
    console.error('Grok fact-check error:', error);

    // Fallback to simple AI-only check
    console.log('⚠️ Falling back to AI-only fact-check...');
    return factCheckFallback(title, content, source);
  }
}

// ============================================================
// Fallback: Simple AI-only fact-check (no web search)
// Used when the deep check fails
// ============================================================
async function factCheckFallback(
  title: string,
  content: string,
  source: string
): Promise<FactCheckResult> {
  try {
    const systemPrompt = `Du er en erfaren fakta-checker. Analysér denne nyhedsartikel og vurder dens troværdighed.

Returnér JSON:
{
  "score": <0-100>,
  "summary": "<kort vurdering på dansk>",
  "claims": [
    {"text": "<påstand>", "verdict": "<true|mostly-true|mixed|mostly-false|false|unverified>", "explanation": "<forklaring>"}
  ]
}

Score-guide:
- 85-100: Troværdig kilde, verificerbare fakta
- 70-84: Generelt korrekt, mangler nuancer
- 50-69: Blandet troværdighed
- 30-49: Vildledende
- 0-29: Misinformation

BEMÆRK: Dette er en AI-vurdering UDEN websøgning. Vær konservativ med din score.`;

    const userMessage = `Kilde: ${source}\nOverskrift: ${title}\n\nIndhold: ${content || '(kun overskrift)'}`;
    const responseText = await callGrok(QUALITY_MODEL, systemPrompt, userMessage, 0.3, 20000);
    const result = JSON.parse(responseText);

    return {
      score: Math.min(100, Math.max(0, Number(result.score) || 50)),
      summary: (result.summary || 'AI-vurdering uden websøgning') + ' (Bemærk: verificeret uden websøgning)',
      claims: Array.isArray(result.claims) ? result.claims.map((c: { text?: string; verdict?: string; explanation?: string }) => ({
        text: c.text || '',
        verdict: ['true', 'mostly-true', 'mixed', 'mostly-false', 'false', 'unverified'].includes(c.verdict || '')
          ? c.verdict as Claim['verdict']
          : 'unverified',
        explanation: c.explanation || '',
      })) : [],
      sources: [],
      sourcesConsulted: 0,
      sourceLinks: [],
      checkedAt: new Date().toISOString(),
      verificationMethod: 'ai-only',
    };
  } catch (error) {
    console.error('Fallback fact-check also failed:', error);
    return {
      score: -1,
      summary: `Fejl ved fakta-check: ${error instanceof Error ? error.message : 'ukendt fejl'}`,
      claims: [],
      sources: [],
      checkedAt: new Date().toISOString(),
      verificationMethod: 'ai-only',
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
- "danmark": Nyheder der primært handler om Danmark, dansk politik, danske virksomheder, danske personer
- "europa": Nyheder om europæiske lande (UNDTAGEN Danmark), EU, europæisk politik
- "verden": Nyheder om resten af verden, globale emner
- "sladder": Lette, ligegyldige eller uvæsentlige nyheder. Brug denne kategori for nyheder der IKKE passer ind i de seriøse kategorier – f.eks. kuriositeter, underholdning, "soft news", ligegyldige begivenheder, kendisstof uden samfundsrelevans, livsstil, viral-historier, eller nyheder med meget lav nyhedsværdi.

SubCategory-regler:
- "finans": Økonomi, aktier, valuta, virksomhedsnyheder, handelsnyheder, renter, boligmarked
- "generelt": Alt der IKKE er økonomi/finans

VIGTIGT: isGossip = true OG category = "sladder" for alle nyheder der er lette/ligegyldige/uvæsentlige – det behøver IKKE være kendissladder, det er bare "bløde nyheder" uden seriøs nyhedsværdi.`;

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
• "danmark" – handler om Danmark, dansk politik, danske virksomheder (Novo Nordisk, Mette Frederiksen, DR, danske byer osv.)
• "europa" – europæiske lande UNDTAGEN Danmark, EU-politik
• "verden" – USA, Asien, Mellemøsten, Afrika, globalt
• "sladder" – lette/ligegyldige/uvæsentlige nyheder. Alt der IKKE passer i de seriøse kategorier: kuriositeter, underholdning, "soft news", ligegyldige begivenheder, viral-historier, kendisstof uden samfundsrelevans, livsstil, nyheder med meget lav nyhedsværdi.

subCategory: "finans" for økonomi/aktier/business/valuta/renter, ellers "generelt"
region: landet/området nyheden handler om (f.eks. "Danmark", "USA", "EU", "Kina")
isGossip: true for lette/ligegyldige/uvæsentlige nyheder (SÆT OGSÅ category til "sladder")
confidence: 70-95 for tydelige, 50-69 for tvetydige

VIGTIGT: Overskrifter på dansk handler OFTE om Danmark – check om de nævner danske emner!
VIGTIGT: "sladder" er IKKE kun kendissladder – det er alle nyheder der er lette, bløde eller ligegyldige sammenlignet med seriøse nyheder.`;

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
