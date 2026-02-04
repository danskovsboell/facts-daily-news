import { RawSource } from '@/lib/types';

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const FAST_MODEL = 'grok-3-mini-fast';

export interface SourceGroup {
  topic: string;
  sources: RawSource[];
}

export async function groupRelatedSources(sources: RawSource[]): Promise<SourceGroup[]> {
  if (sources.length === 0) return [];

  // For small batches, treat each as its own group
  if (sources.length <= 3 || !GROK_API_KEY) {
    return sources.map((s) => ({
      topic: s.title,
      sources: [s],
    }));
  }

  try {
    const numbered = sources
      .slice(0, 40) // limit to 40 for API
      .map((s, i) => `${i + 1}. [${s.source_name}] ${s.title}`)
      .join('\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: FAST_MODEL,
        messages: [
          {
            role: 'system',
            content: `Du grupperer nyhedsoverskrifter efter emne. Nyheder om SAMME begivenhed/emne skal samles.

Returnér JSON: {"groups":[[1,3,5],[2],[4,6],...]}
Hvert array indeholder numrene på relaterede nyheder (1-indexed).
Grupper der deler emne skal have 2-5 elementer. Unikke nyheder er alene i deres gruppe.
Max 20 grupper.`,
          },
          { role: 'user', content: numbered },
        ],
        temperature: 0.1,
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

    const parsed = JSON.parse(content);
    const groups: number[][] = parsed.groups || [];

    const limitedSources = sources.slice(0, 40);

    return groups
      .filter((g) => Array.isArray(g) && g.length > 0)
      .map((indices) => {
        const groupSources = indices
          .map((i) => limitedSources[i - 1])
          .filter(Boolean);
        return {
          topic: groupSources[0]?.title || 'Ukendt emne',
          sources: groupSources,
        };
      })
      .filter((g) => g.sources.length > 0);
  } catch (error) {
    console.error('Source grouping error:', error);
    // Fallback: each source is its own group
    return sources.map((s) => ({
      topic: s.title,
      sources: [s],
    }));
  }
}
