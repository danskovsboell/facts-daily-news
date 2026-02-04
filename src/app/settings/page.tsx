'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useUserInterests } from '@/hooks/useUserInterests';

type ApiStatus = 'active' | 'pending' | 'error' | 'loading';

interface ApiStatuses {
  grok: ApiStatus;
  grok_search: ApiStatus;
  supabase: ApiStatus;
}

const MAX_CUSTOM_INTERESTS = 10;

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    allInterests,
    userInterestIds,
    loading: interestsLoading,
    saveInterests,
    addCustomInterest,
    fetchAllInterests,
  } = useUserInterests();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatuses, setApiStatuses] = useState<ApiStatuses>({
    grok: 'loading',
    grok_search: 'loading',
    supabase: 'loading',
  });

  // Sync selected interests from DB
  useEffect(() => {
    if (!interestsLoading) {
      setSelectedIds(new Set(userInterestIds));
    }
  }, [userInterestIds, interestsLoading]);

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

  const predefinedInterests = useMemo(
    () => allInterests.filter((i) => i.is_predefined),
    [allInterests]
  );

  const customInterests = useMemo(
    () => allInterests.filter((i) => !i.is_predefined && selectedIds.has(i.id)),
    [allInterests, selectedIds]
  );

  const customCount = useMemo(
    () => allInterests.filter((i) => !i.is_predefined && selectedIds.has(i.id)).length,
    [allInterests, selectedIds]
  );

  const toggleInterest = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSaved(false);
    setError(null);
  };

  const handleAddCustom = async () => {
    const name = customInput.trim();
    if (!name) return;

    if (customCount >= MAX_CUSTOM_INTERESTS) {
      setError(`Du kan højst tilføje ${MAX_CUSTOM_INTERESTS} egne interesser`);
      return;
    }

    const { id, error: addError } = await addCustomInterest(name);
    if (addError) {
      setError(addError);
      return;
    }

    if (id) {
      setSelectedIds((prev) => new Set(prev).add(id));
    }

    setCustomInput('');
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    if (selectedIds.size < 1) {
      setError('Vælg mindst 1 interesse');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: saveError } = await saveInterests(Array.from(selectedIds));
    if (saveError) {
      setError(saveError);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#c5c5c5]">⚙️ Indstillinger</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Tilpas dit nyhedsfeed efter dine interesser
      </p>

      {/* Interests section */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[#c5c5c5]">
          Interesseområder
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Vælg de emner du er mest interesseret i. Nyheder vil blive prioriteret
          efter dine valg.
        </p>

        {interestsLoading ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-9 w-24 animate-pulse rounded-full bg-zinc-800"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Error message */}
            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Predefined interests */}
            <div className="mt-4 flex flex-wrap gap-2">
              {predefinedInterests.map((interest) => {
                const isSelected = selectedIds.has(interest.id);
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-accent-500/50 bg-accent-600/20 text-accent-400 hover:bg-accent-600/30'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                    }`}
                  >
                    {isSelected && <span className="mr-1">✓</span>}
                    {interest.name}
                  </button>
                );
              })}
            </div>

            {/* Custom interests section */}
            {user && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium text-zinc-400">
                  Egne interesser
                  <span className="ml-2 text-xs text-zinc-600">
                    ({customCount}/{MAX_CUSTOM_INTERESTS})
                  </span>
                </h3>

                {/* Added custom interests */}
                {customInterests.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {customInterests.map((interest) => (
                      <span
                        key={interest.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-accent-500/50 bg-accent-600/20 px-3 py-1.5 text-sm text-accent-400"
                      >
                        {interest.name}
                        <button
                          onClick={() => toggleInterest(interest.id)}
                          className="ml-0.5 text-accent-500/60 transition-colors hover:text-accent-300"
                          title="Fjern interesse"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add new custom interest */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                    placeholder="Tilføj egen interesse..."
                    maxLength={50}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-[#c5c5c5] placeholder-zinc-600 outline-none transition-colors focus:border-accent-600 focus:ring-1 focus:ring-accent-600"
                  />
                  <button
                    onClick={handleAddCustom}
                    disabled={!customInput.trim() || customCount >= MAX_CUSTOM_INTERESTS}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Tilføj
                  </button>
                </div>
              </div>
            )}

            {/* Save / Reset */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
              >
                {saving ? 'Gemmer...' : saved ? '✓ Gemt!' : 'Gem ændringer'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* About section */}
      <section className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-[#c5c5c5]">Om appen</h2>
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
        <h2 className="text-lg font-semibold text-[#c5c5c5]">API Status</h2>
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
