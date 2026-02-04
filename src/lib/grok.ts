import { FactCheckResult, Category } from './types';

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

/**
 * Fact-check a news article using Grok (xAI)
 * Placeholder - requires GROK_API_KEY in .env.local
 */
export async function factCheck(
  title: string,
  content: string,
  source: string
): Promise<FactCheckResult> {
  if (!GROK_API_KEY) {
    // Return mock data when no API key is configured
    return {
      score: Math.floor(Math.random() * 40) + 60, // 60-100
      summary: 'Fakta-check ikke tilgængelig - API nøgle mangler',
      claims: [
        {
          text: title,
          verdict: 'unverified',
          explanation: 'Konfigurer GROK_API_KEY for at aktivere fakta-check',
        },
      ],
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: `Du er en fakta-checker. Analysér følgende nyhedsartikel og vurder dens troværdighed.
Returnér et JSON-objekt med:
- score (0-100): samlet troværdighedsscore
- summary: kort opsummering af din vurdering
- claims: array af individuelle påstande med verdict (true/mostly-true/mixed/mostly-false/false/unverified) og explanation`,
          },
          {
            role: 'user',
            content: `Kilde: ${source}\nOverskrift: ${title}\nIndhold: ${content}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      ...result,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Grok fact-check error:', error);
    return {
      score: -1,
      summary: 'Fejl ved fakta-check',
      claims: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Search X (Twitter) for related posts using Grok
 * Placeholder - requires GROK_API_KEY
 */
export async function searchX(query: string): Promise<string[]> {
  if (!GROK_API_KEY) {
    return ['X-søgning ikke tilgængelig - API nøgle mangler'];
  }

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'Find relevante X/Twitter-posts om dette emne. Returnér et JSON array af strings.',
          },
          {
            role: 'user',
            content: query,
          },
        ],
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Grok X search error:', error);
    return [];
  }
}

/**
 * Categorize a news article using Grok
 * Placeholder - requires GROK_API_KEY
 */
export async function categorize(
  title: string,
  content: string
): Promise<{ category: Category; tags: string[] }> {
  if (!GROK_API_KEY) {
    return {
      category: 'verden',
      tags: ['uncategorized'],
    };
  }

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: `Kategorisér denne nyhedsartikel. Returnér JSON med:
- category: "danmark" | "europa" | "verden" | "sladder"
- tags: array af relevante emneord`,
          },
          {
            role: 'user',
            content: `${title}\n\n${content}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Grok categorize error:', error);
    return { category: 'verden', tags: [] };
  }
}
