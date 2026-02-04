'use client';

import { useUserInterests } from '@/hooks/useUserInterests';
import { DEFAULT_INTERESTS } from '@/lib/constants';

interface InterestFilterProps {
  interests?: string[];
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export default function InterestFilter({
  interests,
  activeTag,
  onTagChange,
}: InterestFilterProps) {
  const { userInterestNames, loading } = useUserInterests();

  // Use explicitly passed interests, or user's DB interests, or defaults
  const tags = interests ?? (loading ? DEFAULT_INTERESTS : userInterestNames);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] text-zinc-600">Filtrer:</span>
      {tags.map((tag) => {
        const isActive = activeTag === tag;
        return (
          <button
            key={tag}
            onClick={() => onTagChange(isActive ? null : tag)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              isActive
                ? 'border border-accent-500/60 bg-accent-600/25 text-accent-300 shadow-sm shadow-accent-500/10'
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
