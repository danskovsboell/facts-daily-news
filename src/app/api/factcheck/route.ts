import { NextRequest, NextResponse } from 'next/server';
import { factCheck } from '@/lib/grok';

export const dynamic = 'force-dynamic';

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
