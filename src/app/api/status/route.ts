import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const grokConfigured = !!process.env.GROK_API_KEY;
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  return NextResponse.json({
    grok: grokConfigured ? 'active' : 'pending',
    grok_search: grokConfigured ? 'active' : 'pending',
    supabase: supabaseConfigured ? 'active' : 'pending',
  });
}
