'use client';

import { DEFAULT_INTERESTS } from '@/lib/constants';

interface InterestFilterProps {
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export default function InterestFilter({
  activeTag,
  onTagChange,
}: InterestFilterProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] text-zinc-600">Filtrer:</span>
      {DEFAULT_INTERESTS.map((tag) => {
        const isActive = activeTag === tag;
        return (
          <button
            key={tag}
            onClick={() => onTagChange(isActive ? null : tag)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              isActive
                ? 'border border-blue-500/60 bg-blue-600/25 text-blue-300 shadow-sm shadow-blue-500/10'
                : 'border border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-400'
            }`}
          >
            #{tag}
          </button>
        );
      })}
      {activeTag && (
        <button
          onClick={() => onTagChange(null)}
          className="ml-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
        >
          ✕ Nulstil
        </button>
      )}
    </div>
  );
}
