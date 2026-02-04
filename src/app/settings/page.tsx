'use client';

import { useState, useEffect } from 'react';
import InterestTags from '@/components/InterestTags';
import { ALL_INTERESTS, DEFAULT_INTERESTS } from '@/lib/constants';

type ApiStatus = 'active' | 'pending' | 'error' | 'loading';

interface ApiStatuses {
  grok: ApiStatus;
  grok_search: ApiStatus;
  supabase: ApiStatus;
}

export default function SettingsPage() {
  const [interests, setInterests] = useState<string[]>(DEFAULT_INTERESTS);
  const [saved, setSaved] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<ApiStatuses>({
    grok: 'loading',
    grok_search: 'loading',
    supabase: 'loading',
  });

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('fdn-interests');
    if (stored) {
      try {
        setInterests(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  // Fetch API status from server-side route
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('Failed to fetch status');
        const data = await res.json();
        setApiStatuses({
          grok: data.grok || 'pending',
          grok_search: data.grok_search || 'pending',
          supabase: data.supabase || 'pending',
        });
      } catch {
        setApiStatuses({
          grok: 'error',
          grok_search: 'error',
          supabase: 'error',
        });
      }
    }
    fetchStatus();
  }, []);

  const handleToggle = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('fdn-interests', JSON.stringify(interests));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setInterests(DEFAULT_INTERESTS);
    localStorage.setItem('fdn-interests', JSON.stringify(DEFAULT_INTERESTS));
    setSaved(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-200">⚙️ Indstillinger</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Tilpas dit nyhedsfeed efter dine interesser
      </p>

      {/* Interests section */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-200">
          Interesseområder
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Vælg de emner du er mest interesseret i. Nyheder vil blive prioriteret
          efter dine valg.
        </p>

        <div className="mt-4">
          <InterestTags
            interests={ALL_INTERESTS}
            selected={interests}
            onToggle={handleToggle}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            {saved ? '✓ Gemt!' : 'Gem ændringer'}
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
          >
            Nulstil til standard
          </button>
        </div>
      </section>

      {/* About section */}
      <section className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-200">Om appen</h2>
        <div className="mt-3 space-y-2 text-sm text-zinc-500">
          <p>
            <strong className="text-zinc-400">Facts on Daily News</strong> er et
            AI-drevet nyhedsdashboard der bruger Grok (xAI) til at opdage og
            skrive nyheder i realtid.
          </p>
          <p>
            Nyheder opdages via Grok web search og dækker Danmark, Europa,
            Verden, samt dine interesseområder som Tesla, AI, Grøn Energi,
            Økonomi & Finans og Renter.
          </p>
          <p>
            Artikler skrives af Grok baseret på de opdagede kilder, og
            fakta-scores angiver en AI-vurdering af troværdigheden.
          </p>
        </div>
      </section>

      {/* API Status */}
      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-zinc-200">API Status</h2>
        <div className="mt-3 space-y-2">
          <StatusRow label="Grok Web Search (Nyhedsopdagelse)" status={apiStatuses.grok_search} />
          <StatusRow label="Grok (Artikelskrivning)" status={apiStatuses.grok} />
          <StatusRow label="Supabase (Database)" status={apiStatuses.supabase} />
        </div>
      </section>
    </div>
  );
}

function StatusRow({
  label,
  status,
}: {
  label: string;
  status: 'active' | 'pending' | 'error' | 'loading';
}) {
  const statusConfig = {
    active: { dot: 'bg-green-500', text: 'Aktiv', textColor: 'text-green-400' },
    pending: { dot: 'bg-yellow-500', text: 'Afventer API nøgle', textColor: 'text-yellow-400' },
    error: { dot: 'bg-red-500', text: 'Fejl', textColor: 'text-red-400' },
    loading: { dot: 'bg-zinc-500 animate-pulse', text: 'Tjekker...', textColor: 'text-zinc-500' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${config.dot}`} />
        <span className={`text-xs ${config.textColor}`}>{config.text}</span>
      </div>
    </div>
  );
}
