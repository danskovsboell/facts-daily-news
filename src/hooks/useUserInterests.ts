'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { DEFAULT_INTERESTS, ALL_INTERESTS } from '@/lib/constants';

export interface Interest {
  id: string;
  name: string;
  is_predefined: boolean;
  active_users: number;
}

export interface UserInterest {
  interest_id: string;
  interest: Interest;
}

// Generate stable IDs for hardcoded interests
function makeInterestId(name: string): string {
  return `predefined-${name.toLowerCase().replace(/[^a-z0-9æøå]+/g, '-').replace(/-+$/, '')}`;
}

// Build Interest objects from the ALL_INTERESTS constant
function buildFallbackInterests(): Interest[] {
  return ALL_INTERESTS.map((name) => ({
    id: makeInterestId(name),
    name,
    is_predefined: true,
    active_users: 0,
  }));
}

const LS_KEY_USER_INTERESTS = 'facts_user_interest_ids';
const LS_KEY_ONBOARDING = 'facts_onboarding_completed';
const LS_KEY_CUSTOM_INTERESTS = 'facts_custom_interests';

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useUserInterests() {
  const { user } = useAuth();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [allInterests, setAllInterests] = useState<Interest[]>([]);
  const [userInterestIds, setUserInterestIds] = useState<Set<string>>(new Set());
  const [userInterestNames, setUserInterestNames] = useState<string[]>(DEFAULT_INTERESTS);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // Track whether DB tables are available
  const dbAvailable = useRef<boolean | null>(null);

  // Fetch all predefined interests — with fallback to constants
  const fetchAllInterests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('interests')
        .select('*')
        .order('name');

      if (!error && data && data.length > 0) {
        dbAvailable.current = true;
        // Merge any localStorage custom interests
        const customFromLs = lsGet<Interest[]>(LS_KEY_CUSTOM_INTERESTS, []);
        const merged = [...data];
        for (const ci of customFromLs) {
          if (!merged.find((d) => d.id === ci.id)) {
            merged.push(ci);
          }
        }
        setAllInterests(merged);
        return merged;
      }
    } catch {
      // DB query failed
    }

    // Fallback: use hardcoded interests + any custom ones from localStorage
    dbAvailable.current = false;
    const fallback = buildFallbackInterests();
    const customFromLs = lsGet<Interest[]>(LS_KEY_CUSTOM_INTERESTS, []);
    const combined = [...fallback, ...customFromLs];
    setAllInterests(combined);
    return combined;
  }, [supabase]);

  // Fetch user's selected interests — with localStorage fallback
  const fetchUserInterests = useCallback(async () => {
    if (!user) {
      // Anonymous: check localStorage
      const storedIds = lsGet<string[]>(LS_KEY_USER_INTERESTS, []);
      if (storedIds.length > 0) {
        setUserInterestIds(new Set(storedIds));
        // Resolve names from allInterests or fallback
        const interests = allInterests.length > 0 ? allInterests : buildFallbackInterests();
        const names = storedIds
          .map((id) => interests.find((i) => i.id === id)?.name)
          .filter(Boolean) as string[];
        setUserInterestNames(names.length > 0 ? names : DEFAULT_INTERESTS);
      } else {
        setUserInterestIds(new Set());
        setUserInterestNames(DEFAULT_INTERESTS);
      }
      setOnboardingCompleted(lsGet<boolean | null>(LS_KEY_ONBOARDING, null));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Try DB first
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (!profileError && profile) {
        setOnboardingCompleted(profile.onboarding_completed ?? false);
      } else {
        // DB unavailable — use localStorage
        setOnboardingCompleted(lsGet<boolean>(LS_KEY_ONBOARDING, false));
      }

      const { data: userInterests, error: uiError } = await supabase
        .from('user_interests')
        .select('interest_id, interests(id, name, is_predefined)')
        .eq('user_id', user.id);

      if (!uiError && userInterests && userInterests.length > 0) {
        const ids = new Set(userInterests.map((ui: Record<string, unknown>) => ui.interest_id as string));
        setUserInterestIds(ids);
        const names = userInterests.map((ui: Record<string, unknown>) => {
          const interest = ui.interests as unknown as Interest;
          return interest?.name || '';
        }).filter(Boolean);
        setUserInterestNames(names);
        // Sync to localStorage as backup
        lsSet(LS_KEY_USER_INTERESTS, Array.from(ids));
      } else {
        // DB unavailable or no user interests — fallback to localStorage
        const storedIds = lsGet<string[]>(LS_KEY_USER_INTERESTS, []);
        if (storedIds.length > 0) {
          setUserInterestIds(new Set(storedIds));
          const interests = allInterests.length > 0 ? allInterests : buildFallbackInterests();
          const names = storedIds
            .map((id) => interests.find((i) => i.id === id)?.name)
            .filter(Boolean) as string[];
          setUserInterestNames(names.length > 0 ? names : DEFAULT_INTERESTS);
        } else {
          setUserInterestIds(new Set());
          setUserInterestNames(DEFAULT_INTERESTS);
        }
      }
    } catch (err) {
      console.error('Error fetching user interests:', err);
      // Fallback to localStorage
      const storedIds = lsGet<string[]>(LS_KEY_USER_INTERESTS, []);
      if (storedIds.length > 0) {
        setUserInterestIds(new Set(storedIds));
      }
      setOnboardingCompleted(lsGet<boolean>(LS_KEY_ONBOARDING, false));
    } finally {
      setLoading(false);
    }
  }, [user, supabase, allInterests]);

  // Save user interests — with localStorage fallback
  const saveInterests = useCallback(async (selectedInterestIds: string[]) => {
    // Always persist to localStorage
    lsSet(LS_KEY_USER_INTERESTS, selectedInterestIds);

    // Update local state immediately
    setUserInterestIds(new Set(selectedInterestIds));
    const interests = allInterests.length > 0 ? allInterests : buildFallbackInterests();
    const names = selectedInterestIds
      .map((id) => interests.find((i) => i.id === id)?.name)
      .filter(Boolean) as string[];
    setUserInterestNames(names.length > 0 ? names : DEFAULT_INTERESTS);

    if (!user) return { error: null };

    // Try DB save if available
    if (dbAvailable.current === false) return { error: null };

    try {
      await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', user.id);

      if (selectedInterestIds.length > 0) {
        const inserts = selectedInterestIds.map((interestId) => ({
          user_id: user.id,
          interest_id: interestId,
        }));

        const { error } = await supabase
          .from('user_interests')
          .insert(inserts);

        if (error) {
          // DB write failed but localStorage is saved — not a user-facing error
          console.warn('DB save failed, using localStorage:', error.message);
        }
      }
      return { error: null };
    } catch (err) {
      console.warn('DB save failed, using localStorage:', err);
      return { error: null };
    }
  }, [user, supabase, allInterests]);

  // Add a custom interest — with localStorage fallback
  const addCustomInterest = useCallback(async (name: string): Promise<{ id: string | null; error: string | null }> => {
    // Check for duplicates (case insensitive) in current list
    const existing = allInterests.find(
      (i) => i.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      return { id: existing.id, error: null };
    }

    // Try DB first if available
    if (user && dbAvailable.current !== false) {
      try {
        const trimmedName = name.trim();
        const slug = trimmedName.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const searchPrompt = `Search for today's latest news about ${trimmedName}. Find recent articles, developments, and updates.`;
        const { data, error } = await supabase
          .from('interests')
          .insert({
            name: trimmedName,
            slug,
            is_predefined: false,
            category: 'custom',
            search_prompt: searchPrompt,
          })
          .select('id')
          .single();

        if (!error && data) {
          await fetchAllInterests();
          return { id: data.id, error: null };
        }
      } catch {
        // Fall through to localStorage
      }
    }

    // Fallback: create locally and store in localStorage
    const newInterest: Interest = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      is_predefined: false,
      active_users: 0,
    };

    const customFromLs = lsGet<Interest[]>(LS_KEY_CUSTOM_INTERESTS, []);
    customFromLs.push(newInterest);
    lsSet(LS_KEY_CUSTOM_INTERESTS, customFromLs);

    setAllInterests((prev) => [...prev, newInterest]);
    return { id: newInterest.id, error: null };
  }, [user, supabase, allInterests, fetchAllInterests]);

  // Mark onboarding as complete — with localStorage fallback
  const completeOnboarding = useCallback(async () => {
    lsSet(LS_KEY_ONBOARDING, true);
    setOnboardingCompleted(true);

    if (!user || dbAvailable.current === false) return;

    try {
      await supabase
        .from('user_profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
    } catch {
      // localStorage already set — fine
    }
  }, [user, supabase]);

  // Load on mount and when user changes
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await fetchAllInterests();
      if (!cancelled) {
        await fetchUserInterests();
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    allInterests,
    userInterestIds,
    userInterestNames,
    loading,
    onboardingCompleted,
    fetchAllInterests,
    fetchUserInterests,
    saveInterests,
    addCustomInterest,
    completeOnboarding,
  };
}
