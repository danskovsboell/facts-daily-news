-- ============================================================
-- Facts on Daily News - Phase 1: User System Migration
-- ============================================================

-- 1. user_profiles: Bruger-metadata (udvidelse af Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed BOOLEAN DEFAULT FALSE
);

-- 2. interests: Master-liste over alle interesser (predefined + custom)
CREATE TABLE IF NOT EXISTS interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_predefined BOOLEAN DEFAULT FALSE,
  search_prompt TEXT,
  category TEXT DEFAULT 'custom',
  created_by UUID REFERENCES auth.users(id),
  active_users INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. user_interests: Many-to-many relation
CREATE TABLE IF NOT EXISTS user_interests (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, interest_id)
);

-- Predefined interests (seed data)
INSERT INTO interests (name, slug, is_predefined, category, search_prompt) VALUES
  ('Tesla', 'tesla', true, 'tech',
   'Search for today''s latest news about Tesla, SpaceX, and Elon Musk. Include stock price, product news, regulatory developments.'),
  ('AI', 'ai', true, 'tech',
   'Search for today''s latest AI news. Include OpenAI, Google DeepMind, Anthropic, Meta AI, xAI, Microsoft, NVIDIA, and major AI developments.'),
  ('Grøn Energi', 'groen-energi', true, 'energi',
   'Search for today''s latest news about green energy, renewable energy, solar, wind power, hydrogen, batteries, and sustainability.'),
  ('Økonomi & Finans', 'oekonomi-finans', true, 'finans',
   'Search for today''s most important global financial news. Include stock markets, interest rates, central banks, inflation, bonds, currencies.'),
  ('Renter', 'renter', true, 'finans',
   'Search for today''s latest news about interest rates, central bank decisions (ECB, Fed, Nationalbanken), mortgage rates, and monetary policy.'),
  ('Politik', 'politik', true, 'general', NULL),
  ('Sundhed', 'sundhed', true, 'general', NULL),
  ('Tech', 'tech-general', true, 'tech', NULL),
  ('Klima', 'klima', true, 'energi', NULL),
  ('Krypto', 'krypto', true, 'finans', NULL),
  ('Ejendomme', 'ejendomme', true, 'finans', NULL),
  ('Sport', 'sport', true, 'general', NULL),
  ('Kultur', 'kultur', true, 'general', NULL),
  ('Videnskab', 'videnskab', true, 'general', NULL),
  ('Startups', 'startups', true, 'tech', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_interest ON user_interests(interest_id);
CREATE INDEX IF NOT EXISTS idx_interests_slug ON interests(slug);
CREATE INDEX IF NOT EXISTS idx_interests_predefined ON interests(is_predefined);
CREATE INDEX IF NOT EXISTS idx_interests_active_users ON interests(active_users DESC);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- interests policies
CREATE POLICY "Anyone can read interests"
  ON interests FOR SELECT USING (true);
CREATE POLICY "Auth users can create custom interests"
  ON interests FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND is_predefined = false
  );

-- user_interests policies
CREATE POLICY "Users can read own interests"
  ON user_interests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add own interests"
  ON user_interests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own interests"
  ON user_interests FOR DELETE USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access profiles"
  ON user_profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access interests"
  ON interests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access user_interests"
  ON user_interests FOR ALL USING (auth.role() = 'service_role');

-- Trigger: auto-opret profil ved signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: opdater active_users count
CREATE OR REPLACE FUNCTION update_interest_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE interests SET active_users = active_users + 1 WHERE id = NEW.interest_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE interests SET active_users = active_users - 1 WHERE id = OLD.interest_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_interest_change ON user_interests;
CREATE TRIGGER on_user_interest_change
  AFTER INSERT OR DELETE ON user_interests
  FOR EACH ROW EXECUTE FUNCTION update_interest_user_count();

-- Function: Hent alle aktive interesser
CREATE OR REPLACE FUNCTION get_active_custom_interests()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  search_prompt TEXT,
  active_users INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.slug, i.search_prompt, i.active_users
  FROM interests i
  WHERE i.active_users > 0
    AND i.is_predefined = false
  ORDER BY i.active_users DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
