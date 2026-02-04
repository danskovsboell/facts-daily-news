'use client';

interface InterestTagsProps {
  interests: string[];
  selected: string[];
  onToggle: (interest: string) => void;
}

export default function InterestTags({ interests, selected, onToggle }: InterestTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {interests.map((interest) => {
        const isSelected = selected.includes(interest);
        return (
          <button
            key={interest}
            onClick={() => onToggle(interest)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              isSelected
                ? 'border-accent-500/50 bg-accent-600/20 text-accent-400 hover:bg-accent-600/30'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            {isSelected && <span className="mr-1">✓</span>}
            {interest}
          </button>
        );
      })}
    </div>
  );
}
