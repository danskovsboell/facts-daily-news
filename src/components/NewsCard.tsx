'use client';

import { NewsItem } from '@/lib/types';
import FactScore from './FactScore';
import SourceBadge from './SourceBadge';

interface NewsCardProps {
  item: NewsItem;
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

export default function NewsCard({ item }: NewsCardProps) {
  return (
    <article className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex flex-col gap-3">
        {/* Top: source + time + fact score */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SourceBadge source={item.source} />
            <span className="text-[11px] text-zinc-600">
              {timeAgo(item.pubDate)}
            </span>
            {item.isGossip && (
              <span className="rounded-full bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-medium text-pink-400">
                🗣️ Sladder
              </span>
            )}
            {item.region && item.region !== 'unknown' && (
              <span className="text-[10px] text-zinc-600">
                📍 {item.region}
              </span>
            )}
          </div>
          <FactScore
            score={item.factScore}
            details={item.factDetails}
            articleTitle={item.title}
            articleContent={item.description || item.content}
            articleSource={item.source}
          />
        </div>

        {/* Title */}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <h3 className="text-base font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-accent-400">
            {item.title}
          </h3>
        </a>

        {/* Description */}
        {item.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">
            {item.description}
          </p>
        )}

        {/* Bottom action */}
        <div className="flex items-center justify-between pt-1">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-500 transition-colors hover:text-accent-400"
          >
            Læs mere →
          </a>
          {item.grokCategory && item.grokCategory !== item.category && (
            <span className="text-[10px] text-zinc-600 italic">
              AI: {item.grokCategory}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
