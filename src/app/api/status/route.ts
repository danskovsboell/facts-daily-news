import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Check which APIs are configured by verifying env vars exist and are non-empty
  const grokConfigured = !!process.env.GROK_API_KEY;
  const newsapiConfigured = !!process.env.NEWSAPI_KEY;
  const mediastackConfigured = !!process.env.MEDIASTACK_KEY;
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  return NextResponse.json({
    grok: grokConfigured ? 'active' : 'pending',
    newsapi: newsapiConfigured ? 'active' : 'pending',
    mediastack: mediastackConfigured ? 'active' : 'pending',
    supabase: supabaseConfigured ? 'active' : 'pending',
    rss: 'active', // RSS feeds don't need API keys
  });
}
