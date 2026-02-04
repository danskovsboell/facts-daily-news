import { NextRequest, NextResponse } from 'next/server';
import { fetchAllFeeds } from '@/lib/rss';
import { Category, SubCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as Category | null;
    const subCategory = searchParams.get('subCategory') as SubCategory | null;

    const items = await fetchAllFeeds(
      category || undefined,
      subCategory || undefined
    );

    // Add mock fact scores for demo purposes
    const itemsWithScores = items.map((item) => ({
      ...item,
      factScore: Math.floor(Math.random() * 40) + 60, // 60-100 random score
    }));

    return NextResponse.json({
      items: itemsWithScores,
      count: itemsWithScores.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', items: [] },
      { status: 500 }
    );
  }
}
