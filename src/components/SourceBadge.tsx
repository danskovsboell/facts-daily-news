interface SourceBadgeProps {
  source: string;
  url?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  'DR Nyheder': 'bg-red-900/30 text-red-400 border-red-800/30',
  'DR Kultur': 'bg-red-900/30 text-red-400 border-red-800/30',
  'TV2 Nyheder': 'bg-orange-900/30 text-orange-400 border-orange-800/30',
  'Berlingske': 'bg-sky-900/30 text-sky-400 border-sky-800/30',
  'Politiken': 'bg-teal-900/30 text-teal-400 border-teal-800/30',
  'Jyllands-Posten': 'bg-cyan-900/30 text-cyan-400 border-cyan-800/30',
  'Børsen': 'bg-emerald-900/30 text-emerald-400 border-emerald-800/30',
  'Reuters Business': 'bg-accent-900/30 text-accent-400 border-accent-800/30',
  'BBC News': 'bg-rose-900/30 text-rose-400 border-rose-800/30',
  'BBC World': 'bg-rose-900/30 text-rose-400 border-rose-800/30',
  'Deutsche Welle': 'bg-violet-900/30 text-violet-400 border-violet-800/30',
  'The Guardian Europe': 'bg-indigo-900/30 text-indigo-400 border-indigo-800/30',
  'AP News': 'bg-amber-900/30 text-amber-400 border-amber-800/30',
  'Al Jazeera': 'bg-yellow-900/30 text-yellow-400 border-yellow-800/30',
  'Bloomberg': 'bg-purple-900/30 text-purple-400 border-purple-800/30',
  'Financial Times': 'bg-pink-900/30 text-pink-400 border-pink-800/30',
};

const DEFAULT_COLOR = 'bg-zinc-800/50 text-zinc-400 border-zinc-700/30';

export default function SourceBadge({ source, url }: SourceBadgeProps) {
  const colorClass = SOURCE_COLORS[source] || DEFAULT_COLOR;

  const badge = (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${colorClass}`}
    >
      {source}
    </span>
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:brightness-125 transition-all">
        {badge}
      </a>
    );
  }

  return badge;
}
