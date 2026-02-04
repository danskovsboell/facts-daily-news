-- Migration: Add news_date column to articles table
-- This stores the actual publication date/time of the news event
-- (as opposed to created_at which is when we generated the article)

ALTER TABLE articles ADD COLUMN IF NOT EXISTS news_date TIMESTAMPTZ;

-- Index for sorting by news_date
CREATE INDEX IF NOT EXISTS idx_articles_news_date ON articles(news_date DESC NULLS LAST);

-- Comment
COMMENT ON COLUMN articles.news_date IS 'Actual publication date/time of the news event, estimated from sources';
