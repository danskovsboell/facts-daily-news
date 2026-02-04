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
        <Link href="/" className="mt-4 inline-block text-blue-500 hover:text-blue-400">
          ← Tilbage til forsiden
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link href="/" className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-300">
        ← Tilbage til nyheder
      </Link>

      {/* Article header */}
      <header className="mb-8">
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
          <span className="text-xs text-zinc-600">{timeAgo(article.created_at)}</span>
        </div>

        <h1 className="mb-4 text-2xl font-bold leading-tight text-zinc-200 md:text-3xl">
          {article.title}
        </h1>

        <p className="text-base leading-relaxed text-zinc-400">
          {article.summary}
        </p>
      </header>

      {/* Fact score */}
      {article.fact_score != null && article.fact_score >= 0 && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FactScoreBadge score={article.fact_score} />
              <span className="text-sm text-zinc-500">AI Fakta-vurdering</span>
            </div>
            {article.fact_details && article.fact_details.claims?.length > 0 && (
              <button
                onClick={() => setShowFactDetails(!showFactDetails)}
                className="text-xs text-blue-500 hover:text-blue-400"
              >
                {showFactDetails ? 'Skjul detaljer' : 'Vis detaljer'}
              </button>
            )}
          </div>

          {showFactDetails && article.fact_details && (
            <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
              {article.fact_details.claims?.map((claim, i) => (
                <div key={i} className="rounded-lg bg-zinc-800/50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-sm">
                      {claim.verdict === 'true' ? '✅' :
                       claim.verdict === 'mostly-true' ? '🟢' :
                       claim.verdict === 'mixed' ? '🟡' :
                       claim.verdict === 'mostly-false' ? '🟠' :
                       claim.verdict === 'false' ? '❌' : '❓'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-zinc-300">{claim.text}</p>
                      <p className="mt-1 text-xs text-zinc-500">{claim.explanation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {article.interest_tags && article.interest_tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {article.interest_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Article body */}
      <div
        className="prose prose-invert prose-zinc max-w-none prose-headings:text-zinc-200 prose-p:text-zinc-400 prose-p:leading-relaxed prose-a:text-blue-400 prose-strong:text-zinc-300"
        dangerouslySetInnerHTML={{
          __html: article.body
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br/>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')
            .replace(/## (.*?)(?=<)/g, '<h2>$1</h2>')
            .replace(/### (.*?)(?=<)/g, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
        }}
      />

      {/* Sources */}
      {article.sources && article.sources.length > 0 && (
        <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-400">
            📰 Kilder ({article.sources.length})
          </h3>
          <div className="space-y-2">
            {article.sources.map((source, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">{source.source_name}</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-1 text-sm text-blue-500 hover:text-blue-400"
                >
                  {source.title}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related articles */}
      {related.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 text-sm font-semibold text-zinc-400">
            Relaterede artikler
          </h3>
          <div className="space-y-3">
            {related.map((rel) => (
              <Link
                key={rel.id}
                href={`/article/${rel.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 transition-all hover:border-zinc-700 hover:bg-zinc-900"
              >
                <h4 className="text-sm font-medium text-zinc-300 hover:text-blue-400">
                  {rel.title}
                </h4>
                <p className="mt-1 line-clamp-1 text-xs text-zinc-600">{rel.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
