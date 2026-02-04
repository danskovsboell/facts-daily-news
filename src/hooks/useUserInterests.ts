'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { DEFAULT_INTERESTS } from '@/lib/constants';

export interface Interest {
  id: string;
  name: string;
  is_predefined: boolean;
}

export interface UserInterest {
  interest_id: string;
  interest: Interest;
}

export function useUserInterests() {
  const { user } = useAuth();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [allInterests, setAllInterests] = useState<Interest[]>([]);
  const [userInterestIds, setUserInterestIds] = useState<Set<string>>(new Set());
  const [userInterestNames, setUserInterestNames] = useState<string[]>(DEFAULT_INTERESTS);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // Fetch all predefined interests
  const fetchAllInterests = useCallback(async () => {
    const { data } = await supabase
      .from('interests')
      .select('*')
      .order('name');
    if (data) setAllInterests(data);
    return data || [];
  }, [supabase]);

  // Fetch user's selected interests
  const fetchUserInterests = useCallback(async () => {
    if (!user) {
      setUserInterestIds(new Set());
      setUserInterestNames(DEFAULT_INTERESTS);
      setOnboardingCompleted(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch user profile for onboarding status
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      setOnboardingCompleted(profile?.onboarding_completed ?? false);

      // Fetch user's interests with interest details
      const { data: userInterests } = await supabase
        .from('user_interests')
        .select('interest_id, interests(id, name, is_predefined)')
        .eq('user_id', user.id);

      if (userInterests && userInterests.length > 0) {
        const ids = new Set(userInterests.map((ui: Record<string, unknown>) => ui.interest_id as string));
        setUserInterestIds(ids);
        const names = userInterests.map((ui: Record<string, unknown>) => {
          const interest = ui.interests as unknown as Interest;
          return interest?.name || '';
        }).filter(Boolean);
        setUserInterestNames(names);
      } else {
        setUserInterestIds(new Set());
        setUserInterestNames(DEFAULT_INTERESTS);
      }
    } catch (err) {
      console.error('Error fetching user interests:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // Save user interests (used by onboarding + settings)
  const saveInterests = useCallback(async (selectedInterestIds: string[]) => {
    if (!user) return { error: 'Not authenticated' };

    try {
      // Delete existing user_interests
      await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', user.id);

      // Insert new ones
      if (selectedInterestIds.length > 0) {
        const inserts = selectedInterestIds.map((interestId) => ({
          user_id: user.id,
          interest_id: interestId,
        }));

        const { error } = await supabase
          .from('user_interests')
          .insert(inserts);

        if (error) return { error: error.message };
      }

      // Refresh state
      await fetchUserInterests();
      return { error: null };
    } catch (err) {
      return { error: String(err) };
    }
  }, [user, supabase, fetchUserInterests]);

  // Add a custom interest
  const addCustomInterest = useCallback(async (name: string): Promise<{ id: string | null; error: string | null }> => {
    if (!user) return { id: null, error: 'Not authenticated' };

    // Check for duplicates (case insensitive)
    const existing = allInterests.find(
      (i) => i.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      return { id: existing.id, error: null };
    }

    const { data, error } = await supabase
      .from('interests')
      .insert({ name: name.trim(), is_predefined: false })
      .select('id')
      .single();

    if (error) return { id: null, error: error.message };

    // Refresh interests list
    await fetchAllInterests();
    return { id: data.id, error: null };
  }, [user, supabase, allInterests, fetchAllInterests]);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    setOnboardingCompleted(true);
  }, [user, supabase]);

  // Load on mount and when user changes
  useEffect(() => {
    fetchAllInterests();
    fetchUserInterests();
  }, [fetchAllInterests, fetchUserInterests]);

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
