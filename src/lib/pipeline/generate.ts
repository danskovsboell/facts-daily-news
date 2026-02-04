import { RawSource, Article, ArticleSource, ArticleFactDetails, Category, SubCategory } from '@/lib/types';

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const ARTICLE_MODEL = 'grok-3-mini';

// Rate limiting: max 50 articles per hour
let articleCount = 0;
let lastResetTime = Date.now();

function checkRateLimit(): boolean {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;

  if (now - lastResetTime > hourInMs) {
    articleCount = 0;
    lastResetTime = now;
  }

  if (articleCount >= 50) {
    return false;
  }

  articleCount++;
  return true;
}

interface GrokArticleResponse {
  title: string;
  summary: string;
  body: string;
  fact_score: number;
  fact_details: ArticleFactDetails;
  category: Category;
  sub_category: SubCategory;
  interest_tags: string[];
  is_gossip: boolean;
}

export async function generateArticle(sources: RawSource[]): Promise<Article | null> {
  if (sources.length === 0 || !GROK_API_KEY) {
    return null;
  }

  if (!checkRateLimit()) {
    console.warn('Rate limit reached: 50 articles per hour');
    return null;
  }

  try {
    const sourcesText = sources
      .map((s, i) => {
        return `KILDE ${i + 1}:
Medie: ${s.source_name}
Overskrift: ${s.title}
Beskrivelse: ${s.description}
URL: ${s.url}
Udgivet: ${new Date(s.published_at).toLocaleString('da-DK')}
`;
      })
      .join('\n---\n\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARTICLE_MODEL,
        messages: [
          {
            role: 'system',
            content: `Du er en professionel dansk nyhedsjournalist. Skriv en original dansk artikel baseret på følgende kilder.

REGLER:
- Skriv på dansk
- Vær objektiv og faktuel
- Brug dine egne formuleringer – kopier IKKE direkte fra kilderne
- Inkluder alle vigtige fakta fra kilderne
- Angiv aldrig at du er en AI
- Artiklen skal have: overskrift, kort opsummering (1-2 sætninger), og brødtekst
- Fakta-tjek alle påstande mod kilderne og giv en samlet score 0-100
- Brug markdown-formatering i brødteksten (## overskrifter, **fed**, *kursiv*, lister, etc.)

SVAR I JSON FORMAT:
{
  "title": "Klar og fængende overskrift",
  "summary": "Kort opsummering i 1-2 sætninger der fanger essensen",
  "body": "Fuld artikel med markdown formatering...",
  "fact_score": 85,
  "fact_details": {
    "claims": [
      {"text": "Påstand fra artiklen", "verdict": "true", "explanation": "Forklaring"}
    ],
    "sources_checked": ["kilde1.dk", "kilde2.dk"]
  },
  "category": "danmark",
  "sub_category": "generelt",
  "interest_tags": ["ai", "teknologi"],
  "is_gossip": false
}`,
          },
          {
            role: 'user',
            content: sourcesText,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`Grok API ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response');

    const parsed: GrokArticleResponse = JSON.parse(content);

    // Convert sources to ArticleSource format
    const articleSources: ArticleSource[] = sources.map((s) => ({
      title: s.title,
      url: s.url,
      source_name: s.source_name,
    }));

    const article: Article = {
      id: crypto.randomUUID(),
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      category: parsed.category,
      sub_category: parsed.sub_category,
      fact_score: parsed.fact_score,
      fact_details: parsed.fact_details,
      interest_tags: parsed.interest_tags || [],
      sources: articleSources,
      is_gossip: parsed.is_gossip || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published: true,
    };

    return article;
  } catch (error) {
    console.error('Article generation error:', error);
    return null;
  }
}
