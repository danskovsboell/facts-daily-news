'use client';

import { useState } from 'react';
import { FACT_SCORE_COLORS } from '@/lib/constants';
import { FactCheckResult, SourceLink } from '@/lib/types';

interface FactScoreProps {
  score?: number;
  details?: FactCheckResult;
  articleId?: string;
  articleTitle?: string;
  articleContent?: string;
  articleSource?: string;
}

function getScoreLevel(score: number): 'high' | 'medium' | 'low' | 'unknown' {
  if (score < 0) return 'unknown';
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
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

function SourceLinkChip({ source }: { source: SourceLink }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-accent-400 hover:bg-zinc-700 hover:text-accent-300 transition-colors"
      title={source.url}
    >
      🔗 {source.domain || source.title || 'Kilde'}
    </a>
  );
}

export default function FactScore({ score: initialScore, details: initialDetails, articleId, articleTitle, articleContent, articleSource }: FactScoreProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(initialScore);
  const [details, setDetails] = useState(initialDetails);

  // Fetch fact-check on demand (initial check)
  const handleFactCheck = async () => {
    if (details && details.claims.length > 0) {
      setShowDetails(!showDetails);
      return;
    }

    if (!articleId && !articleTitle) {
      if (details) setShowDetails(!showDetails);
      return;
    }

    await runFactCheck(false);
  };

  // Force re-check (bypass cache, always call API)
  const handleReCheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runFactCheck(true);
  };

  const runFactCheck = async (force: boolean) => {
    setLoading(true);
    setShowDetails(true);
    try {
      const response = await fetch('/api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: articleId || undefined,
          title: articleTitle || '',
          content: articleContent || '',
          source: articleSource || 'unknown',
          force,
        }),
      });
      if (response.ok) {
        const data: FactCheckResult = await response.json();
        setDetails(data);
        if (data.score >= 0) setScore(data.score);
      }
    } catch (error) {
      console.error('Fact-check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // No score yet - show "check facts" button
  if (score === undefined || score === null) {
    return (
      <div className="relative">
        <button
          onClick={handleFactCheck}
          disabled={loading}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer hover:brightness-110 ${
            loading
              ? 'border-accent-500/30 bg-accent-500/10 text-accent-400'
              : `${FACT_SCORE_COLORS.unknown.bg} ${FACT_SCORE_COLORS.unknown.text} ${FACT_SCORE_COLORS.unknown.border} hover:border-accent-500/50 hover:text-accent-400`
          }`}
        >
          {loading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
              Websøgning...
            </>
          ) : (
            <>🔍 Dyb fakta-check</>
          )}
        </button>

        {showDetails && loading && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                <span className="text-xs text-zinc-400">Grok AI søger på nettet...</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-500/50" />
                  Fakta-checker med websøgning...
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetails && !loading && details && (
          <DetailsPopup details={details} onClose={() => setShowDetails(false)} />
        )}
      </div>
    );
  }

  const level = getScoreLevel(score);
  const colors = FACT_SCORE_COLORS[level];

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleFactCheck}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer hover:brightness-110 ${colors.bg} ${colors.text} ${colors.border}`}
          title="Klik for fakta-check detaljer"
        >
          {loading ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <span className="text-[10px]">
              {level === 'high' ? '🟢' : level === 'medium' ? '🟡' : level === 'low' ? '🔴' : '❓'}
            </span>
          )}
          Fakta: {score >= 0 ? `${score}%` : 'N/A'}
          {details?.sourcesConsulted && details.sourcesConsulted > 0 && (
            <span className="ml-0.5 text-[10px] opacity-70">
              ({details.sourcesConsulted} kilder)
            </span>
          )}
        </button>
        <button
          onClick={handleReCheck}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-[10px] text-zinc-400 transition-all cursor-pointer hover:border-accent-500/50 hover:text-accent-400 hover:bg-zinc-800 disabled:opacity-50"
          title="Kør nyt fakta-tjek med websøgning"
        >
          {loading ? (
            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
          ) : (
            '🔄'
          )}
          Tjek igen
        </button>
      </div>

      {showDetails && loading && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              <span className="text-xs text-zinc-400">Grok AI søger på nettet...</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-500/50" />
                Re-verificerer med websøgning...
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetails && !loading && details && (
        <DetailsPopup details={details} onClose={() => setShowDetails(false)} />
      )}
    </div>
  );
}

function DetailsPopup({ details, onClose }: { details: FactCheckResult; onClose: () => void }) {
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null);

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-96 max-h-[70vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
      {/* Header with source count */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-[#c5c5c5]">🔍 Fakta-check</h4>
          {details.verificationMethod === 'web-search' && (
            <span className="rounded-full bg-green-500/20 border border-green-500/30 px-2 py-0.5 text-[9px] font-bold text-green-400 uppercase tracking-wider">
              🌐 Web Verificeret
            </span>
          )}
          {details.verificationMethod === 'ai-only' && (
            <span className="rounded-full bg-yellow-500/20 border border-yellow-500/30 px-2 py-0.5 text-[9px] font-medium text-yellow-400">
              🤖 AI-vurdering
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-[#c5c5c5] text-lg leading-none">✕</button>
      </div>

      {/* Source count badge */}
      {details.sourcesConsulted != null && details.sourcesConsulted > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent-500/10 border border-accent-500/20 px-3 py-2">
          <span className="text-base">🌐</span>
          <span className="text-xs font-medium text-accent-400">
            Verificeret mod {details.sourcesConsulted} webkilder
          </span>
        </div>
      )}

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-zinc-500">Troværdighedsscore</span>
          <span className={`text-sm font-bold ${
            details.score >= 80 ? 'text-green-400' :
            details.score >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {details.score}/100
          </span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              details.score >= 80 ? 'bg-green-500' :
              details.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, details.score))}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      <p className="mb-3 text-xs leading-relaxed text-zinc-400">{details.summary}</p>

      {/* Per-claim verifications */}
      {details.claims.length > 0 && (
        <div className="mb-3 space-y-2">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Påstande verificeret ({details.claims.length})
          </h5>
          {details.claims.map((claim, i) => (
            <div key={i} className="rounded-lg bg-zinc-800/80 border border-zinc-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedClaim(expandedClaim === i ? null : i)}
                className="w-full text-left p-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-sm shrink-0">{getVerdictEmoji(claim.verdict)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[11px] font-semibold ${getVerdictColor(claim.verdict)}`}>
                        {getVerdictLabel(claim.verdict)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-snug line-clamp-2">
                      &ldquo;{claim.text}&rdquo;
                    </p>
                  </div>
                  <span className="text-zinc-600 text-[10px] shrink-0">
                    {expandedClaim === i ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {expandedClaim === i && (
                <div className="px-2.5 pb-2.5 border-t border-zinc-700/50">
                  <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
                    {claim.explanation}
                  </p>

                  {/* Per-claim sources */}
                  {claim.claimSources && claim.claimSources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {claim.claimSources.slice(0, 5).map((src, j) => (
                        <SourceLinkChip key={j} source={src} />
                      ))}
                      {claim.claimSources.length > 5 && (
                        <span className="text-[10px] text-zinc-600 self-center">
                          +{claim.claimSources.length - 5} mere
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* All source links */}
      {details.sourceLinks && details.sourceLinks.length > 0 && (
        <div className="mb-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
            Alle kilder ({details.sourceLinks.length})
          </h5>
          <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg bg-zinc-800/50 p-2">
            {details.sourceLinks.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-accent-400 transition-colors truncate"
              >
                <span className="text-zinc-600 shrink-0">📎</span>
                <span className="font-medium text-zinc-300 shrink-0">{source.domain}</span>
                <span className="truncate opacity-60">{source.url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Legacy sources (backward compat for older data) */}
      {(!details.sourceLinks || details.sourceLinks.length === 0) && details.sources && details.sources.length > 0 && (
        <div className="mb-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Kilder</h5>
          <ul className="mt-1 space-y-0.5">
            {details.sources.map((source, i) => (
              <li key={i} className="text-[11px] text-zinc-400">📎 {source}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
        <p className="text-[10px] text-zinc-600">
          Tjekket: {new Date(details.checkedAt).toLocaleString('da-DK')}
        </p>
        <span className="text-[10px] text-zinc-700">
          {details.verificationMethod === 'web-search' ? '🌐 Grok + Websøgning' : '🤖 Grok AI'}
        </span>
      </div>
    </div>
  );
}
