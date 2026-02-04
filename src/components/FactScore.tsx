'use client';

import { useState } from 'react';
import { FACT_SCORE_COLORS } from '@/lib/constants';
import { FactCheckResult } from '@/lib/types';

interface FactScoreProps {
  score?: number;
  details?: FactCheckResult;
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

export default function FactScore({ score, details }: FactScoreProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (score === undefined || score === null) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${FACT_SCORE_COLORS.unknown.bg} ${FACT_SCORE_COLORS.unknown.text} ${FACT_SCORE_COLORS.unknown.border}`}>
        ❓ Ikke tjekket
      </span>
    );
  }

  const level = getScoreLevel(score);
  const colors = FACT_SCORE_COLORS[level];

  return (
    <div className="relative">
      <button
        onClick={() => details && setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${colors.bg} ${colors.text} ${colors.border} ${details ? 'cursor-pointer hover:brightness-110' : ''}`}
      >
        <span className="text-[10px]">
          {level === 'high' ? '🟢' : level === 'medium' ? '🟡' : level === 'low' ? '🔴' : '❓'}
        </span>
        Fakta: {score >= 0 ? `${score}%` : 'N/A'}
      </button>

      {showDetails && details && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Fakta-check detaljer</h4>
            <button
              onClick={() => setShowDetails(false)}
              className="text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <p className="mb-3 text-xs text-zinc-400">{details.summary}</p>

          {details.claims.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Påstande
              </h5>
              {details.claims.map((claim, i) => (
                <div key={i} className="rounded-lg bg-zinc-800 p-2">
                  <div className="flex items-center gap-1.5">
                    <span>{getVerdictEmoji(claim.verdict)}</span>
                    <span className="text-[11px] font-medium text-zinc-300">
                      {getVerdictLabel(claim.verdict)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">{claim.explanation}</p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[10px] text-zinc-600">
            Tjekket: {new Date(details.checkedAt).toLocaleString('da-DK')}
          </p>
        </div>
      )}
    </div>
  );
}
