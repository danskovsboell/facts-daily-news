import { NextRequest, NextResponse } from 'next/server';
import { factCheck, getCacheStats } from '@/lib/grok';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Allow longer for detailed fact-check

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, source } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'Grok API not configured', score: -1 },
        { status: 503 }
      );
    }

    // Full detailed fact-check (uses grok-3-mini for quality)
    const result = await factCheck(title, content || '', source || 'unknown');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fact-check API error:', error);
    return NextResponse.json(
      { error: 'Failed to fact-check article' },
      { status: 500 }
    );
  }
}

// GET endpoint for cache stats (debug)
export async function GET() {
  const stats = getCacheStats();
  return NextResponse.json({
    status: 'ok',
    grokConfigured: !!process.env.GROK_API_KEY,
    cache: stats,
  });
}
