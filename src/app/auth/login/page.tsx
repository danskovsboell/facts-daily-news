'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { APP_NAME } from '@/lib/constants';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Forkert email eller adgangskode');
        } else {
          setError(error.message);
        }
      } else {
        // Check if onboarding is completed
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('onboarding_completed')
              .eq('id', user.id)
              .single();
            if (profile && !profile.onboarding_completed) {
              router.push('/onboarding');
              router.refresh();
              return;
            }
          }
        } catch {
          // Proceed to home on error
        }
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Noget gik galt. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-600 text-2xl font-bold">
            F
          </div>
          <h1 className="text-2xl font-bold text-[#c5c5c5]">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-zinc-500">Log ind på din konto</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="din@email.dk"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-[#c5c5c5] placeholder-zinc-600 outline-none transition-colors focus:border-accent-600 focus:ring-1 focus:ring-accent-600"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-400">
              Adgangskode
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-[#c5c5c5] placeholder-zinc-600 outline-none transition-colors focus:border-accent-600 focus:ring-1 focus:ring-accent-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Logger ind...
              </span>
            ) : (
              'Log ind'
            )}
          </button>
        </form>

        {/* Signup link */}
        <p className="mt-6 text-center text-sm text-zinc-500">
          Har du ikke en konto?{' '}
          <Link href="/auth/signup" className="text-accent-400 hover:text-accent-300 transition-colors">
            Opret konto
          </Link>
        </p>
      </div>
    </div>
  );
}
