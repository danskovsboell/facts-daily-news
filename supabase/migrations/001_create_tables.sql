-- Facts on Daily News V2 - Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nzmhfborsapbnlckufrx/sql

-- ============================================================
-- raw_sources: Ingested news items from RSS/NewsAPI/Mediastack
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  url TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  category TEXT DEFAULT 'general',
  sub_category TEXT DEFAULT 'general',
  raw_content TEXT DEFAULT '',
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- articles: AI-generated articles from grouped sources
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  sub_category TEXT NOT NULL DEFAULT 'general',
  fact_score REAL DEFAULT 0,
  fact_details JSONB,
  interest_tags TEXT[] DEFAULT '{}',
  sources JSONB DEFAULT '[]',
  is_gossip BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_raw_sources_processed ON raw_sources(processed);
CREATE INDEX IF NOT EXISTS idx_raw_sources_fetched ON raw_sources(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_sources_url ON raw_sources(url);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published);
CREATE INDEX IF NOT EXISTS idx_articles_gossip ON articles(is_gossip);

-- ============================================================
-- Row Level Security (RLS) - public read, service role write
-- ============================================================
ALTER TABLE raw_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Allow public read on articles
CREATE POLICY IF NOT EXISTS "Public can read published articles"
  ON articles FOR SELECT
  USING (published = true);

-- Allow service role full access on articles
CREATE POLICY IF NOT EXISTS "Service role full access articles"
  ON articles FOR ALL
  USING (auth.role() = 'service_role');

-- Allow service role full access on raw_sources
CREATE POLICY IF NOT EXISTS "Service role full access raw_sources"
  ON raw_sources FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Updated_at trigger for articles
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
