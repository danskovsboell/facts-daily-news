'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Article } from '@/lib/types';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Lige nu';
  if (diffMin < 60) return `${diffMin} min siden`;
  if (diffHours < 24) return `${diffHours} time${diffHours > 1 ? 'r' : ''} siden`;
  if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? 'e' : ''} siden`;
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function FactScoreBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 85) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (score >= 70) return 'bg-lime-500/20 text-lime-400 border-lime-500/30';
    if (score >= 50) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (score >= 30) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getLabel = () => {
    if (score >= 85) return 'Meget troværdig';
    if (score >= 70) return 'Troværdig';
    if (score >= 50) return 'Blandet';
    if (score >= 30) return 'Tvivlsom';
    return 'Lav troværdighed';
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${getColor()}`}>
      <span className="text-lg font-bold">{score}</span>
      <span className="text-xs">{getLabel()}</span>
    </div>
  );
}

function getVerdictEmoji(verdict: string): string {
  switch (verdict) {
    case 'true': return '✅';
    case 'mostly-true': return '🟢';
    case 'mixed': return '🟡';
    case 'mostly-false': return '🟠';
    case 'false': return '❌';
    default: return '❓';
  }
}

function getVerdictLabel(verdict: string): string {
  switch (verdict) {
    case 'true': return 'Bekræftet';
    case 'mostly-true': return 'Overvejende sandt';
    case 'mixed': return 'Blandet';
    case 'mostly-false': return 'Overvejende falsk';
    case 'false': return 'Falsk';
    default: return 'Ikke verificeret';
  }
}

function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'true': return 'text-green-400';
    case 'mostly-true': return 'text-green-400';
    case 'mixed': return 'text-yellow-400';
    case 'mostly-false': return 'text-orange-400';
    case 'false': return 'text-red-400';
    default: return 'text-zinc-500';
  }
}

/* --- Helpers for formatting article body text --- */

function formatArticleBody(raw: string): string {
  // Strip leading markdown heading (duplicate title from AI generation)
  let cleaned = raw;
  const lines = cleaned.split('\n');
  if (lines[0]?.startsWith('# ')) {
    lines.shift();
    cleaned = lines.join('\n').trimStart();
  }

  // Split into paragraphs by double newline
  const paragraphs = cleaned
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const formatted = paragraphs.map((p, idx) => {
    // Detect markdown headings
    if (/^### /.test(p)) {
      const text = p.replace(/^### /, '');
      return `<h3 class="article-h3">${text}</h3>`;
    }
    if (/^## /.test(p)) {
      const text = p.replace(/^## /, '');
      return `<h2 class="article-h2">${text}</h2>`;
    }

    // Inline markdown: bold, italic
    let html = p
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');

    // Detect "pull-quote" style: lines that are a short quote or start with > or «
    if (/^[>»«""]/.test(p) && p.length < 300) {
      return `<blockquote class="article-pullquote">${html}</blockquote>`;
    }

    // Detect key-number paragraphs (short paragraphs dominated by numbers/percentages)
    const numberMatch = p.match(/\d+[\.,]?\d*\s*(%|procent|mia\.|mio\.|kr\.|milliarder|millioner)/gi);
    if (numberMatch && numberMatch.length >= 2 && p.length < 200) {
      return `<div class="article-keyfact">${html}</div>`;
    }

    // First paragraph gets lead styling
    if (idx === 0) {
      return `<p class="article-lead">${html}</p>`;
    }

    // Every 4th paragraph, add a subtle divider before it for visual rhythm
    const divider = idx > 0 && idx % 4 === 0
      ? '<hr class="article-divider" />'
      : '';

    return `${divider}<p class="article-paragraph">${html}</p>`;
  });

  return formatted.join('\n');
}

interface RelatedArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  fact_score: number;
  created_at: string;
}

export default function ArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFactDetails, setShowFactDetails] = useState(false);
  const [factChecking, setFactChecking] = useState(false);

  const handleFactCheck = async (force: boolean = false) => {
    if (!article) return;
    setFactChecking(true);
    try {
      const response = await fetch('/api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          force,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        setArticle(prev => prev ? {
          ...prev,
          fact_score: result.score,
          fact_details: {
            claims: result.claims || [],
            sources_checked: result.sources || [],
            sourceLinks: result.sourceLinks || [],
            sourcesConsulted: result.sourcesConsulted || 0,
            verificationMethod: result.verificationMethod || 'web-search',
            summary: result.summary || '',
            checkedAt: result.checkedAt,
          },
        } : null);
        setShowFactDetails(true);
      }
    } catch (err) {
      console.error('Fact-check failed:', err);
    } finally {
      setFactChecking(false);
    }
  };

  useEffect(() => {
    async function fetchArticle() {
      try {
        setLoading(true);
        const response = await fetch(`/api/articles/${id}`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Artikel ikke fundet' : 'Fejl ved hentning');
        }
        const data = await response.json();
        setArticle(data.article);
        setRelated(data.related || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ukendt fejl');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-zinc-800" />
          <div className="h-8 w-3/4 rounded bg-zinc-800" />
          <div className="h-4 w-full rounded bg-zinc-800" />
          <div className="h-4 w-2/3 rounded bg-zinc-800" />
          <div className="mt-6 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-zinc-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-lg text-red-400">⚠️ {error || 'Artikel ikke fundet'}</p>
        <Link href="/" className="mt-4 inline-block text-accent-500 hover:text-accent-400">
          ← Tilbage til forsiden
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link href="/" className="mb-4 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
        ← Tilbage til nyheder
      </Link>

      {/* ===== METADATA SECTION (moved to top) ===== */}
      <div className="mb-8 space-y-4">
        {/* Fact score + fact-check buttons */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {article.fact_score != null && article.fact_score >= 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FactScoreBadge score={article.fact_score} />
                  <div>
                    <span className="text-sm text-zinc-500">AI Fakta-vurdering</span>
                    {article.fact_details?.verificationMethod === 'web-search' && (
                      <span className="ml-2 rounded-full bg-green-500/20 border border-green-500/30 px-2 py-0.5 text-[9px] font-bold text-green-400 uppercase tracking-wider">
                        🌐 Web Verificeret
                      </span>
                    )}
                    {article.fact_details?.sources_checked && article.fact_details.sources_checked.length > 0 && (
                      <span className="ml-2 text-[11px] text-accent-400">
                        {article.fact_details.sources_checked.length} kilder
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFactCheck(true)}
                    disabled={factChecking}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:border-accent-500/50 hover:text-accent-400 hover:bg-zinc-800/80 disabled:opacity-50"
                  >
                    {factChecking ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
                    ) : (
                      '🔄'
                    )}
                    Tjek igen
                  </button>
                  {article.fact_details && article.fact_details.claims?.length > 0 && (
                    <button
                      onClick={() => setShowFactDetails(!showFactDetails)}
                      className="text-xs text-accent-500 hover:text-accent-400 transition-colors"
                    >
                      {showFactDetails ? 'Skjul detaljer' : 'Vis detaljer'}
                    </button>
                  )}
                </div>
              </div>

              {factChecking && (
                <div className="mt-4 flex items-center gap-3 rounded-lg bg-accent-500/10 border border-accent-500/20 px-4 py-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                  <div>
                    <span className="text-sm font-medium text-accent-400">Grok AI søger på nettet...</span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Fakta-checker med websøgning — kan tage 10-30 sekunder</p>
                  </div>
                </div>
              )}

              {showFactDetails && article.fact_details && (
                <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
                  {/* Summary */}
                  {article.fact_details.summary && (
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {article.fact_details.summary}
                    </p>
                  )}

                  {/* Claims */}
                  {article.fact_details.claims?.map((claim, i) => (
                    <div key={i} className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-sm shrink-0">
                          {getVerdictEmoji(claim.verdict)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-xs font-semibold ${getVerdictColor(claim.verdict)}`}>
                              {getVerdictLabel(claim.verdict)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-zinc-300">{claim.text}</p>
                          <p className="mt-1 text-xs text-zinc-500">{claim.explanation}</p>
                          {/* Per-claim sources */}
                          {claim.claimSources && claim.claimSources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {claim.claimSources.slice(0, 4).map((src, j) => (
                                <a
                                  key={j}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] text-accent-400 hover:bg-zinc-700 hover:text-accent-300 transition-colors"
                                >
                                  🔗 {src.domain || 'Kilde'}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Source links from web verification */}
                  {article.fact_details.sourceLinks && article.fact_details.sourceLinks.length > 0 && (
                    <div className="rounded-lg bg-zinc-800/30 p-3 mt-2">
                      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                        Webkilder ({article.fact_details.sourceLinks.length})
                      </h5>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {article.fact_details.sourceLinks.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-accent-400 transition-colors truncate"
                          >
                            <span className="text-zinc-600 shrink-0">📎</span>
                            <span className="font-medium text-zinc-300 shrink-0">{src.domain}</span>
                            <span className="truncate opacity-60">{src.url}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legacy sources checked (backward compat) */}
                  {!article.fact_details.sourceLinks && article.fact_details.sources_checked && article.fact_details.sources_checked.length > 0 && (
                    <div className="rounded-lg bg-zinc-800/30 p-3 mt-2">
                      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                        Kilder verificeret mod ({article.fact_details.sources_checked.length})
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {article.fact_details.sources_checked.map((src, i) => (
                          <span key={i} className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-400">
                            📎 {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* No fact score yet - show fact-check button */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5">
                  <span className="text-lg">❓</span>
                  <span className="text-xs text-zinc-500">Ikke fakta-tjekket</span>
                </div>
              </div>
              <button
                onClick={() => handleFactCheck(false)}
                disabled={factChecking}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  factChecking
                    ? 'border-accent-500/30 bg-accent-500/10 text-accent-400'
                    : 'border-accent-500/40 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 hover:border-accent-500/60'
                }`}
              >
                {factChecking ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
                    Websøgning...
                  </>
                ) : (
                  <>🔍 Fakta-tjek</>
                )}
              </button>
            </div>
          )}

          {/* Loading state for no-score articles */}
          {factChecking && !(article.fact_score != null && article.fact_score >= 0) && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-accent-500/10 border border-accent-500/20 px-4 py-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              <div>
                <span className="text-sm font-medium text-accent-400">Grok AI søger på nettet...</span>
                <p className="text-[11px] text-zinc-500 mt-0.5">Verificerer fakta med websøgning — kan tage 10-30 sekunder</p>
              </div>
            </div>
          )}
        </div>

        {/* Interest tags */}
        {article.interest_tags && article.interest_tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {article.interest_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-500/10 px-3 py-1 text-xs text-accent-400 border border-accent-500/20"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ===== ARTICLE HEADER ===== */}
      <header className="mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">
            {article.category === 'danmark' ? '🇩🇰 Danmark' :
             article.category === 'europa' ? '🇪🇺 Europa' :
             article.category === 'verden' ? '🌍 Verden' : '🗣️ Sladder'}
          </span>
          {article.sub_category === 'finans' && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
              💰 Finans
            </span>
          )}
          <span className="text-xs text-zinc-600">{timeAgo(article.news_date || article.created_at)}</span>
        </div>

        <h1 className="mb-4 text-2xl font-bold leading-tight text-[#c5c5c5] md:text-3xl lg:text-4xl">
          {article.title}
        </h1>

        <p className="text-lg leading-relaxed text-zinc-400 border-l-2 border-accent-600 pl-4">
          {article.summary}
        </p>
      </header>

      {/* ===== ARTICLE BODY (formatted for readability) ===== */}
      <article
        className="article-body mx-auto max-w-prose"
        dangerouslySetInnerHTML={{
          __html: formatArticleBody(article.body),
        }}
      />

      {/* ===== SOURCES ===== */}
      {article.sources && article.sources.length > 0 && (
        <div className="mx-auto max-w-prose mt-14">
          <div className="border-t border-zinc-800 pt-8">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              📰 Kilder ({article.sources.length})
            </h3>
            <div className="space-y-3">
              {article.sources.map((source, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 p-3">
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-zinc-600">{source.source_name}</span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm text-accent-500 hover:text-accent-400 transition-colors"
                  >
                    {source.title}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== RELATED ARTICLES ===== */}
      {related.length > 0 && (
        <div className="mx-auto max-w-prose mt-12">
          <div className="border-t border-zinc-800 pt-8">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Relaterede artikler
            </h3>
            <div className="space-y-3">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/article/${rel.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <h4 className="text-sm font-medium text-zinc-300 hover:text-accent-400 transition-colors">
                    {rel.title}
                  </h4>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-600">{rel.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
