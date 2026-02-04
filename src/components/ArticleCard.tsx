'use client';

import Link from 'next/link';
import { Article } from '@/lib/types';
import FactScore from './FactScore';

interface ArticleCardProps {
  article: Article;
}

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
  return date.toLocaleDateString('da-DK');
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    danmark: '🇩🇰 Danmark',
    europa: '🇪🇺 Europa',
    verden: '🌍 Verden',
    sladder: '🗣️ Sladder',
  };
  return labels[cat] || cat;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex flex-col gap-3">
        {/* Top: category + time + fact score */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {categoryLabel(article.category)}
            </span>
            {article.sub_category === 'finans' && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                💰 Finans
              </span>
            )}
            {article.is_gossip && (
              <span className="rounded-full bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-medium text-pink-400">
                🗣️ Sladder
              </span>
            )}
            <span className="text-[11px] text-zinc-600">
              {timeAgo(article.news_date || article.created_at)}
            </span>
          </div>
          <FactScore
            score={article.fact_score != null && article.fact_score >= 0 ? article.fact_score : undefined}
            details={article.fact_details ? {
              score: article.fact_score,
              summary: article.fact_details.summary || `Fakta-score: ${article.fact_score}/100`,
              claims: article.fact_details.claims || [],
              sources: article.fact_details.sources_checked || [],
              sourceLinks: article.fact_details.sourceLinks || [],
              sourcesConsulted: article.fact_details.sourcesConsulted || 0,
              verificationMethod: article.fact_details.verificationMethod || undefined,
              checkedAt: article.fact_details.checkedAt || article.created_at,
            } : undefined}
            articleId={article.id}
            articleTitle={article.title}
            articleContent={article.summary}
            articleSource={article.sources?.[0]?.source_name || 'AI-genereret'}
          />
        </div>

        {/* Title */}
        <Link href={`/article/${article.id}`} className="block">
          <h3 className="text-base font-semibold leading-snug text-[#c5c5c5] transition-colors group-hover:text-accent-400">
            {article.title}
          </h3>
        </Link>

        {/* Summary */}
        {article.summary && (
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">
            {article.summary}
          </p>
        )}

        {/* Tags */}
        {article.interest_tags && article.interest_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {article.interest_tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[10px] text-accent-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom: sources count + read more */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-zinc-600">
            📰 Baseret på {article.sources?.length || 0} kilde{(article.sources?.length || 0) !== 1 ? 'r' : ''}
          </span>
          <Link
            href={`/article/${article.id}`}
            className="text-xs text-accent-500 transition-colors hover:text-accent-400"
          >
            Læs artikel →
          </Link>
        </div>
      </div>
    </article>
  );
}
