'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useUserInterests } from '@/hooks/useUserInterests';
import { APP_NAME } from '@/lib/constants';

const MAX_CUSTOM_INTERESTS = 10;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, displayName } = useAuth();
  const {
    allInterests,
    loading: interestsLoading,
    saveInterests,
    addCustomInterest,
    completeOnboarding,
    fetchAllInterests,
  } = useUserInterests();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Separate predefined and custom interests
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

  // Redirect if not logged in (middleware should handle this, but belt-and-suspenders)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

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
    setError(null);
  };

  const handleSave = async () => {
    if (selectedIds.size < 3) {
      setError('Vælg mindst 3 interesser for at fortsætte');
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

    await completeOnboarding();
    router.push('/');
    router.refresh();
  };

  const handleSkip = async () => {
    setSaving(true);
    setError(null);

    // Save first 5 predefined as defaults
    const defaultIds = predefinedInterests.slice(0, 5).map((i) => i.id);
    await saveInterests(defaultIds);
    await completeOnboarding();
    router.push('/');
    router.refresh();
  };

  if (authLoading || interestsLoading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="animate-pulse text-zinc-500">Indlæser...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 animate-fade-in">
      {/* Welcome header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-600 text-3xl font-bold text-white">
          F
        </div>
        <h1 className="text-2xl font-bold text-[#c5c5c5]">
          Velkommen{displayName ? `, ${displayName}` : ''}! 👋
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Vælg dine interesseområder så vi kan tilpasse dine nyheder.
          <br />
          <span className="text-zinc-600">Vælg mindst 3 for at komme i gang.</span>
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Predefined interests */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">
          Populære emner
        </h2>
        <div className="flex flex-wrap gap-2">
          {predefinedInterests.map((interest) => {
            const isSelected = selectedIds.has(interest.id);
            return (
              <button
                key={interest.id}
                onClick={() => toggleInterest(interest.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-accent-500/50 bg-accent-600/20 text-accent-400 hover:bg-accent-600/30 shadow-sm shadow-accent-500/10'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {isSelected && <span className="mr-1.5">✓</span>}
                {interest.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom interests */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">
          Tilføj egne interesser
          <span className="ml-2 text-xs text-zinc-600">
            ({customCount}/{MAX_CUSTOM_INTERESTS})
          </span>
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            placeholder="f.eks. Rumfart, Gaming, Mode..."
            maxLength={50}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-[#c5c5c5] placeholder-zinc-600 outline-none transition-colors focus:border-accent-600 focus:ring-1 focus:ring-accent-600"
          />
          <button
            onClick={handleAddCustom}
            disabled={!customInput.trim() || customCount >= MAX_CUSTOM_INTERESTS}
            className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Tilføj
          </button>
        </div>

        {/* Show added custom interests */}
        {customInterests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {customInterests.map((interest) => (
              <span
                key={interest.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent-500/50 bg-accent-600/20 px-3 py-1.5 text-sm text-accent-400"
              >
                {interest.name}
                <button
                  onClick={() => toggleInterest(interest.id)}
                  className="ml-0.5 text-accent-500/60 transition-colors hover:text-accent-300"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Selection count */}
      <div className="mt-6 text-center text-xs text-zinc-600">
        {selectedIds.size} valgt{selectedIds.size < 3 && ` · ${3 - selectedIds.size} mere påkrævet`}
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || selectedIds.size < 3}
          className="w-full max-w-sm rounded-lg bg-accent-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Gemmer...
            </span>
          ) : (
            'Gem & gå til nyheder →'
          )}
        </button>
        <button
          onClick={handleSkip}
          disabled={saving}
          className="text-sm text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Spring over · brug standardinteresser
        </button>
      </div>
    </div>
  );
}
