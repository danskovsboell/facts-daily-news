-- Facts on Daily News - V2 Database Setup
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nzmhfborsapbnlckufrx/sql

-- Table: raw_sources - stores fetched news from RSS/NewsAPI/Mediastack
CREATE TABLE IF NOT EXISTS raw_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  category TEXT,
  sub_category TEXT,
  raw_content TEXT,
  processed BOOLEAN DEFAULT false
);

-- Table: articles - AI-generated articles based on grouped sources
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT DEFAULT 'generelt',
  fact_score INTEGER CHECK (fact_score >= 0 AND fact_score <= 100),
  fact_details JSONB,
  interest_tags TEXT[],
  sources JSONB NOT NULL,
  is_gossip BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_sources_processed ON raw_sources(processed);
CREATE INDEX IF NOT EXISTS idx_raw_sources_fetched_at ON raw_sources(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published);

-- Enable Row Level Security (RLS)
ALTER TABLE raw_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on raw_sources" ON raw_sources
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on articles" ON articles
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anonymous users to read published articles
CREATE POLICY "Anon can read published articles" ON articles
  FOR SELECT USING (published = true);
