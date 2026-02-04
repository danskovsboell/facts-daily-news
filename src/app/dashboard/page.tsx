'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page which is the main dashboard
    router.replace('/');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-zinc-500">Omdirigerer til dashboard...</p>
    </div>
  );
}
