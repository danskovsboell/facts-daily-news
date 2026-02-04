'use client';

import { useState } from 'react';
import { FACT_SCORE_COLORS } from '@/lib/constants';
import { FactCheckResult } from '@/lib/types';

interface FactScoreProps {
  score?: number;
  details?: FactCheckResult;
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
    case 'true': return 'Sandt';
    case 'mostly-true': return 'Overvejende sandt';
    case 'mixed': return 'Blandet';
    case 'mostly-false': return 'Overvejende falsk';
    case 'false': return 'Falsk';
    default: return 'Ikke verificeret';
  }
}

export default function FactScore({ score: initialScore, details: initialDetails, articleTitle, articleContent, articleSource }: FactScoreProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(initialScore);
  const [details, setDetails] = useState(initialDetails);

  // Fetch fact-check on demand
  const handleFactCheck = async () => {
    if (details && details.claims.length > 0) {
      setShowDetails(!showDetails);
      return;
    }

    if (!articleTitle) {
      if (details) setShowDetails(!showDetails);
      return;
    }

    setLoading(true);
    setShowDetails(true);
    try {
      const response = await fetch('/api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: articleTitle,
          content: articleContent || '',
          source: articleSource || 'unknown',
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
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
              : `${FACT_SCORE_COLORS.unknown.bg} ${FACT_SCORE_COLORS.unknown.text} ${FACT_SCORE_COLORS.unknown.border} hover:border-blue-500/50 hover:text-blue-400`
          }`}
        >
          {loading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              Tjekker...
            </>
          ) : (
            <>🔍 Tjek fakta</>
          )}
        </button>

        {showDetails && loading && (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
            <div className="flex items-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-xs text-zinc-400">Grok AI analyserer artiklen...</span>
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
      </button>

      {showDetails && details && (
        <DetailsPopup details={details} onClose={() => setShowDetails(false)} />
      )}
    </div>
  );
}

function DetailsPopup({ details, onClose }: { details: FactCheckResult; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">🔍 Fakta-check detaljer</h4>
        <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-zinc-400">{details.summary}</p>

      {details.category && (
        <div className="mb-3">
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
            {details.category}
          </span>
        </div>
      )}

      {details.claims.length > 0 && (
        <div className="mb-3 space-y-2">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Påstande</h5>
          {details.claims.map((claim, i) => (
            <div key={i} className="rounded-lg bg-zinc-800 p-2">
              <div className="flex items-center gap-1.5">
                <span>{getVerdictEmoji(claim.verdict)}</span>
                <span className="text-[11px] font-medium text-zinc-300">{getVerdictLabel(claim.verdict)}</span>
              </div>
              {claim.text && (
                <p className="mt-1 text-[11px] font-medium text-zinc-400">&ldquo;{claim.text}&rdquo;</p>
              )}
              <p className="mt-1 text-[11px] text-zinc-500">{claim.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {details.sources && details.sources.length > 0 && (
        <div className="mb-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Kilder</h5>
          <ul className="mt-1 space-y-0.5">
            {details.sources.map((source, i) => (
              <li key={i} className="text-[11px] text-zinc-400">📎 {source}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">
          Tjekket: {new Date(details.checkedAt).toLocaleString('da-DK')}
        </p>
        <span className="text-[10px] text-zinc-700">Powered by Grok AI</span>
      </div>
    </div>
  );
}
