# 🧑‍💻 Bruger-system & Personlige Interesser — Designforslag

**Dato:** 2025-07-24  
**Projekt:** Facts on Daily News  
**Status:** FORSLAG — afventer Dans beslutninger

---

## Indholdsfortegnelse

1. [Overblik](#1-overblik)
2. [Authentication — Anbefalet tilgang](#2-authentication--anbefalet-tilgang)
3. [Database-skema](#3-database-skema)
4. [Nyhedsopdagelse med brugerdefinerede interesser](#4-nyhedsopdagelse-med-brugerdefinerede-interesser)
5. [UI-flow](#5-ui-flow)
6. [Arkitektur-beslutninger](#6-arkitektur-beslutninger)
7. [Implementeringsplan (faser)](#7-implementeringsplan-faser)
8. [Beslutninger Dan skal tage](#8-beslutninger-dan-skal-tage)
9. [Estimeret indsats](#9-estimeret-indsats)

---

## 1. Overblik

### Nuværende situation
- Interesser gemmes i **localStorage** (`fdn-interests` key)
- 5 standard-interesser hardcoded: Tesla, AI, Grøn Energi, Økonomi & Finans, Renter
- 15 valgbare interesser i settings-siden (fra `ALL_INTERESTS`)
- Grok web search kører 8 faste søgninger (inkl. Tesla, AI, Grøn Energi, Økonomi/Finans)
- Ingen brugerprofiler — alt er anonymt og device-bundet
- "Dine Nyheder" filtrerer lokalt ud fra localStorage-interesser

### Mål
- Brugere kan oprette konto → vælge interesser → få personligt nyhedsfeed
- Brugere kan tilføje **custom emner** (fx "Bitcoin", "Vindmøller", "Novo Nordisk")
- Custom emner driver faktisk nyhedsopdagelse (Grok søger efter dem)
- Interesser følger brugeren på tværs af enheder
- Anonyme brugere (ikke logget ind) beholder nuværende oplevelse

---

## 2. Authentication — Anbefalet tilgang

### Anbefaling: **Supabase Auth med Email + Password (uden verifikation)**

**Hvorfor:**
- Supabase Auth er allerede inkluderet i `@supabase/supabase-js` (0 ekstra dependencies)
- Gratis tier inkluderer 50.000 MAU (Monthly Active Users)
- Email + password er det simpleste for brugerne
- Vi slår email-verifikation **fra** i Supabase Dashboard → instant signup
- Kan nemt tilføje Google/Apple login senere

**Opsætning i Supabase Dashboard:**
1. Authentication → Settings → Email Auth → **Slå "Confirm email" fra**
2. Det er det. Brugere kan straks logge ind efter signup.

### Alternativerne (og hvorfor vi fravælger dem)

| Tilgang | Fordele | Ulemper | Anbefaling |
|---------|---------|---------|------------|
| **Email + password (uden verif.)** | Simpelt, velkendt, hurtigt | Fake emails mulige | ✅ **Anbefalet** |
| **Magic link** | Ingen password at huske | Kræver email-verifikation, langsommere flow | ❌ Modstridende med "ingen verifikation" |
| **Username + password** | Allersimplest | Supabase Auth understøtter det ikke nativt, kræver custom løsning | ❌ Mere arbejde |
| **Social login (Google)** | Nemt for brugerne | Kræver Google Cloud opsætning, OAuth consent screen | 🔜 Fase 2 |

### Teknisk setup

```typescript
// src/lib/supabase-client.ts (ny fil — browser-side client)
import { createClient } from '@supabase/supabase-js';

export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Nye env-variabler (public, browser-side):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://nzmhfborsapbnlckufrx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

> **NB:** `NEXT_PUBLIC_` prefix er nødvendigt for at browseren kan bruge dem. Anon key er designet til at være offentlig — RLS beskytter data.

---

## 3. Database-skema

### Nye tabeller

```sql
-- ============================================================
-- 1. user_profiles: Bruger-metadata (udvidelse af Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 2. interests: Master-liste over alle interesser (predefined + custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,           -- Visningsnavn: "Tesla", "Novo Nordisk"
  slug TEXT NOT NULL UNIQUE,    -- URL-venligt: "tesla", "novo-nordisk"
  is_predefined BOOLEAN DEFAULT FALSE,  -- true = systemdefineret
  search_prompt TEXT,           -- Custom Grok search prompt (null = auto-genereret)
  category TEXT DEFAULT 'custom', -- Gruppering: 'tech', 'finans', 'energi', 'custom'
  created_by UUID REFERENCES auth.users(id),  -- null = system
  active_users INT DEFAULT 0,  -- Cache: antal brugere der følger dette emne
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. user_interests: Many-to-many relation
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interests (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, interest_id)
);

-- ============================================================
-- Predefined interests (seed data)
-- ============================================================
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
  ('Startups', 'startups', true, 'tech', NULL);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_interest ON user_interests(interest_id);
CREATE INDEX IF NOT EXISTS idx_interests_slug ON interests(slug);
CREATE INDEX IF NOT EXISTS idx_interests_predefined ON interests(is_predefined);
CREATE INDEX IF NOT EXISTS idx_interests_active_users ON interests(active_users DESC);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- user_profiles: brugere kan kun se/redigere egne profiler
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- interests: alle kan læse, kun auth brugere kan oprette custom
CREATE POLICY "Anyone can read interests"
  ON interests FOR SELECT USING (true);
CREATE POLICY "Auth users can create custom interests"
  ON interests FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND is_predefined = false
  );

-- user_interests: brugere kan kun se/redigere egne
CREATE POLICY "Users can read own interests"
  ON user_interests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add own interests"
  ON user_interests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own interests"
  ON user_interests FOR DELETE USING (auth.uid() = user_id);

-- Service role full access (til cron jobs, admin)
CREATE POLICY "Service role full access profiles"
  ON user_profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access interests"
  ON interests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access user_interests"
  ON user_interests FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Trigger: auto-opret profil ved signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Trigger: opdater active_users count
-- ============================================================
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

CREATE TRIGGER on_user_interest_change
  AFTER INSERT OR DELETE ON user_interests
  FOR EACH ROW EXECUTE FUNCTION update_interest_user_count();

-- ============================================================
-- Function: Hent alle aktive interesser (som har mindst 1 bruger)
-- ============================================================
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
  LIMIT 20;  -- Max 20 custom interesser ad gangen
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Skema-diagram

```
auth.users (Supabase Auth - eksisterer allerede)
  ├── id (UUID, PK)
  ├── email
  └── raw_user_meta_data (JSONB)

user_profiles
  ├── id (UUID, FK → auth.users)
  ├── display_name
  ├── onboarding_completed
  └── created_at / updated_at

interests
  ├── id (UUID, PK)
  ├── name / slug (UNIQUE)
  ├── is_predefined (bool)
  ├── search_prompt (TEXT, nullable)
  ├── category
  ├── created_by (FK → auth.users, nullable)
  └── active_users (INT, cached count)

user_interests (junction table)
  ├── user_id (FK → auth.users)
  ├── interest_id (FK → interests)
  └── added_at

articles (eksisterende tabel)
  └── interest_tags (TEXT[]) ← matcher interests.name
```

---

## 4. Nyhedsopdagelse med brugerdefinerede interesser

### Nuværende situation

Grok web search kører **8 faste søgninger** hver gang (i `grok-search.ts`):
1. Danmark - Generelt
2. Danmark - Finans & Erhverv
3. Europa - Generelt
4. Verden - Generelt
5. Tesla & Elon Musk
6. AI & Teknologi
7. Grøn Energi & Klima
8. Økonomi, Finans & Renter

Disse kører parallelt og koster ca. 8 Grok API calls per cron-kørsel.

### Anbefaling: **Batched custom søgninger med smart caching**

**Strategi:**

1. **Predefined interesser** → beholder de eksisterende 8 søgninger (altid aktive)
2. **Custom interesser** → dynamisk genererede søgninger, men **kun for emner med ≥1 aktiv bruger**
3. **Batching** → custom emner grupperes i clusters af 3-5 pr. Grok-søgning
4. **Cache** → resultater caches i 30 min (samme som cron-interval)
5. **Max cap** → højst 20 ekstra custom søgninger per cron-kørsel

**Implementering i `grok-search.ts`:**

```typescript
// Ny funktion: Hent dynamiske søgninger baseret på bruger-interesser
async function getCustomSearchQueries(): Promise<SearchQuery[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // Hent alle custom interesser med mindst 1 bruger
  const { data: interests } = await supabase
    .rpc('get_active_custom_interests');

  if (!interests || interests.length === 0) return [];

  // Grupper lignende interesser (max 3-5 per søgning)
  return interests.map(interest => ({
    label: interest.name,
    category: 'verden',  // Default, Grok bestemmer den rigtige
    subCategory: 'generelt',
    prompt: interest.search_prompt || generateDefaultPrompt(interest.name),
  }));
}

function generateDefaultPrompt(topic: string): string {
  return `Search the web for today's latest news about "${topic}". 
Find 3-5 recent, real news stories from reliable sources.

Return ONLY valid JSON:
{"stories": [{"title": "...", "source": "...", "url": "...", "summary": "one sentence in Danish", "category": "${topic.toLowerCase().replace(/\s+/g, '_')}"}]}`;
}
```

### Performance & omkostninger

| Scenarie | Ekstra Grok calls/time | Estimeret ekstra kostnad/måned |
|----------|----------------------|-------------------------------|
| 0 custom emner | 0 | $0 |
| 5 custom emner | +5 per 30 min = +240/dag | ~$2-5 |
| 20 custom emner (max) | +20 per 30 min = +960/dag | ~$10-20 |
| 50+ brugere, 10 unikke custom emner | +10 per 30 min = +480/dag | ~$5-10 |

**Vigtig optimering:** Vi søger per **unikt emne**, ikke per bruger. Hvis 50 brugere alle følger "Novo Nordisk", kører vi kun 1 søgning for det emne.

### Caching-strategi

```
Cron kører hvert 30 min:
  1. Hent alle aktive custom interesser fra DB
  2. For hvert unikt emne: Kør Grok web search
  3. Gem resultater i raw_sources med interest-tag
  4. Pipeline genererer artikler fra sources
  5. Artikler tagges med relevante interest_tags
```

---

## 5. UI-flow

### 5.1 Signup-skærm

**Placement:** Tilgængelig via "Log ind / Opret konto" knap i Header.

**Design:**
```
┌──────────────────────────────────┐
│  🗞️ Facts on Daily News          │
│                                  │
│  Opret konto                     │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Email                      │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Adgangskode (min. 6 tegn) │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Navn (valgfrit)            │  │
│  └────────────────────────────┘  │
│                                  │
│  [     Opret konto     ]         │
│                                  │
│  Har du allerede en konto?       │
│  Log ind →                       │
│                                  │
│  ─── eller ───                   │
│                                  │
│  Fortsæt uden konto →            │
└──────────────────────────────────┘
```

**Implementation:** Next.js page `/auth/signup` + `/auth/login`

### 5.2 Onboarding — Interesse-valg (vises efter signup)

```
┌──────────────────────────────────────────┐
│  🎯 Hvad interesserer dig?               │
│                                          │
│  Vælg mindst 3 emner for at             │
│  personliggøre dit nyhedsfeed            │
│                                          │
│  ── Populære emner ──                    │
│                                          │
│  [⬜ Tesla] [✅ AI] [⬜ Grøn Energi]      │
│  [✅ Økonomi & Finans] [⬜ Renter]        │
│  [⬜ Politik] [⬜ Sundhed] [⬜ Tech]       │
│  [⬜ Klima] [✅ Krypto] [⬜ Ejendomme]    │
│  [⬜ Sport] [⬜ Kultur] [⬜ Videnskab]     │
│  [⬜ Startups]                            │
│                                          │
│  ── Tilføj dine egne emner ──            │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ Skriv et emne... fx "Bitcoin"    │ [+]│
│  └──────────────────────────────────┘    │
│                                          │
│  Dine tilføjede: [Novo Nordisk ×]        │
│                  [Vindenergi ×]          │
│                                          │
│  3 valgt                                 │
│                                          │
│  [     Gem & gå til nyheder     ]        │
│                                          │
│  Spring over for nu →                    │
└──────────────────────────────────────────┘
```

**Implementation:** `/onboarding` page, redirect hertil efter signup hvis `onboarding_completed = false`

### 5.3 Settings-side (opdateret)

Den eksisterende settings-side udvides med:
- **Kontosektion** øverst (email, display name, log ud)
- **Interesser** opdateret med custom emner support
- **Synkronisering** — interesser gemmes i DB i stedet for localStorage
- Fallback: hvis ikke logget ind, bruges localStorage som nu

```
┌──────────────────────────────────────────┐
│  ⚙️ Indstillinger                        │
│                                          │
│  ── Konto ──                             │
│  Email: dan@example.com                  │
│  Navn: Dan                    [Rediger]  │
│                                          │
│  [Log ud]                                │
│                                          │
│  ── Interesseområder ──                  │
│  [Predefined tags som nu...]             │
│                                          │
│  ── Egne emner ──                        │
│  ┌────────────────────────────┐          │
│  │ Tilføj nyt emne...         │ [+]      │
│  └────────────────────────────┘          │
│  [Novo Nordisk ×] [Bitcoin ×]            │
│                                          │
│  [Gem ændringer]                         │
│                                          │
│  ── Om appen ──                          │
│  ...                                     │
└──────────────────────────────────────────┘
```

### 5.4 Header (opdateret)

```
┌──────────────────────────────────────────────────────────────┐
│  🗞️ Facts on Daily News                    [👤 Dan ▾]        │
│                                            ├─ Indstillinger  │
│                                            └─ Log ud         │
│  ── ELLER (ikke logget ind) ──                               │
│  🗞️ Facts on Daily News              [Log ind / Opret konto] │
└──────────────────────────────────────────────────────────────┘
```

### 5.5 "Dine Nyheder" tab — tilpasset per bruger

**Logget ind:**
- Henter interesser fra database (user_interests)
- Viser artikler matchet mod brugerens interesser (predefined + custom)
- InterestFilter viser brugerens egne tags (ikke kun DEFAULT_INTERESTS)
- "Tilføj interesse" knap direkte i filterbaren

**Ikke logget ind:**
- Beholder nuværende oplevelse (localStorage interesser)
- Viser subtil "Opret konto for at tilpasse" prompt

---

## 6. Arkitektur-beslutninger

### 6.1 Filtrering: Server-side vs Client-side

**Anbefaling: Hybrid tilgang**

| Operation | Server/Client | Begrundelse |
|-----------|---------------|-------------|
| Hent artikler per kategori | Server (Supabase query) | Reducerer datamængde |
| Filtrer artikler per interesse-tags | **Server** (SQL `@>` array operator) | Effektivt, skalerbart |
| Finfiltrering / real-time toggle | Client | Hurtig respons, ingen API kald |
| Grok nyhedsopdagelse | Server (cron) | Koster penge, må ikke køre client-side |

**Server-side interest query:**
```sql
-- Hent artikler der matcher MINDST ÉN af brugerens interesser
SELECT * FROM articles
WHERE published = true
  AND interest_tags && ARRAY['Tesla', 'AI', 'Krypto']  -- && = overlaps
ORDER BY created_at DESC
LIMIT 20;
```

### 6.2 Anonyme brugere (fallback)

```
Bruger besøger siden
  ├── Logget ind?
  │   ├── JA → Hent interesser fra DB → Personaliser feed
  │   └── NEJ → Har localStorage interesser?
  │       ├── JA → Brug dem (nuværende oplevelse)
  │       └── NEJ → Vis DEFAULT_INTERESTS (Tesla, AI, etc.)
  │
  └── Ved login: migrer localStorage interesser → DB
```

**Vigtigt:** Når en bruger logger ind første gang, migrerer vi deres localStorage-interesser til databasen. Så mister de ikke deres valg.

### 6.3 Session management

Supabase Auth håndterer sessions automatisk:
- JWT tokens i browser (httpOnly cookies via Supabase SSR)
- Auto-refresh af tokens
- `onAuthStateChange` listener for real-time session updates

**Anbefalet pakke:** `@supabase/ssr` (til Next.js server-side auth)

```bash
npm install @supabase/ssr
```

**Auth context provider:**
```typescript
// src/components/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabaseClient } from '@/lib/supabase-client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ... signUp, signIn, signOut implementering

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
```

### 6.4 Interesse-hook

```typescript
// src/hooks/useInterests.ts
import { useAuth } from '@/components/AuthProvider';
import { supabaseClient } from '@/lib/supabase-client';
import { DEFAULT_INTERESTS } from '@/lib/constants';

export function useInterests() {
  const { user } = useAuth();
  const [interests, setInterests] = useState<string[]>(DEFAULT_INTERESTS);
  const [customInterests, setCustomInterests] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      // Hent fra database
      loadFromDatabase(user.id);
    } else {
      // Fallback til localStorage
      loadFromLocalStorage();
    }
  }, [user]);

  async function addCustomInterest(name: string) {
    // 1. Opret interest i interests-tabellen (hvis den ikke findes)
    // 2. Tilknyt til user_interests
    // 3. Opdater lokal state
  }

  async function removeInterest(interestId: string) { ... }
  async function toggleInterest(interestId: string) { ... }

  return { interests, customInterests, addCustomInterest, removeInterest, toggleInterest };
}
```

---

## 7. Implementeringsplan (faser)

### Fase 1: Auth Foundation (2-3 dage)
- [ ] Installer `@supabase/ssr`
- [ ] Opret `supabase-client.ts` (browser-side) + opdater `supabase.ts` (server-side)
- [ ] Kør SQL migration (user_profiles, interests, user_interests)
- [ ] Seed predefined interests
- [ ] Opret `AuthProvider` context
- [ ] Tilføj `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars
- [ ] Slå email-verifikation fra i Supabase Dashboard
- [ ] Opret `/auth/login` og `/auth/signup` sider
- [ ] Opdater Header med login/bruger-menu
- [ ] Test: signup → login → session persistence

### Fase 2: Onboarding & Interesse-valg (2 dage)
- [ ] Opret `/onboarding` side med interesse-selector
- [ ] Implementer `useInterests` hook
- [ ] Custom interest input (med autocomplete/deduplering)
- [ ] Redirect efter signup: signup → onboarding → forside
- [ ] Opdater Settings-side med kontosektion + custom emner
- [ ] Migrer localStorage → database ved første login
- [ ] Test: fuld signup flow + interesse-valg

### Fase 3: Personaliseret Feed (2-3 dage)
- [ ] Opdater `MyNewsView` til at bruge `useInterests` hook
- [ ] Opdater `InterestFilter` til at vise brugerens egne tags
- [ ] Server-side filtrering via Supabase query (interest_tags overlap)
- [ ] Fallback for anonyme brugere (uændret oplevelse)
- [ ] Test: "Dine Nyheder" viser personligt indhold

### Fase 4: Dynamisk Nyhedsopdagelse (2-3 dage)
- [ ] Udvid `grok-search.ts` med `getCustomSearchQueries()`
- [ ] Implementer `generateDefaultPrompt()` for custom emner
- [ ] Opdater cron job til at inkludere dynamiske søgninger
- [ ] Tilføj `active_users` count-logik
- [ ] Max cap: 20 custom søgninger per cron
- [ ] Opdater article pipeline til at tagge med custom interests
- [ ] Test: custom emne → Grok søger → artikler genereres → vises i feed

### Fase 5: Polish & Edge Cases (1-2 dage)
- [ ] Error handling (network fejl, invalid emails, etc.)
- [ ] Loading states for auth operations
- [ ] "Glemt adgangskode" flow (Supabase har det built-in)
- [ ] Mobile responsive auth sider
- [ ] Rate limiting på custom interest creation (max 10 per bruger)
- [ ] Duplikat-detektion for custom emner (fuzzy match)
- [ ] Analytics: hvilke emner er populære?

### Fase 6 (fremtidig): Social Login & Avanceret
- [ ] Google OAuth login
- [ ] Apple Sign-In
- [ ] Email notifikationer ("Dine daglige nyheder")
- [ ] Interesse-forslag baseret på læsemønstre
- [ ] Share/anbefal interesser

---

## 8. Beslutninger Dan skal tage

### ❓ Beslutning 1: Skal custom emner modereres?
**Muligheder:**
- **A) Ingen moderation** — alle custom emner tillades (simpelt, men risiko for spam/upassende emner)
- **B) Auto-filter** — blokér åbenlyst upassende emner via simpelt keyword-filter
- **C) Manuel godkendelse** — Dan godkender nye custom emner før de aktiverer Grok-søgninger

**Anbefaling:** Start med **A** (ingen moderation). Tilføj **B** hvis der opstår problemer. Vi har allerede max 20 custom søgninger cap som beskyttelse.

### ❓ Beslutning 2: Hvor mange custom emner per bruger?
**Muligheder:**
- 5 custom emner (konservativt)
- 10 custom emner (anbefalet)
- Ubegrænset (risikabelt)

**Anbefaling:** Max **10 custom emner** per bruger. Predefined interesser tæller ikke med.

### ❓ Beslutning 3: Skal anonyme brugere se "Dine Nyheder" tab?
**Muligheder:**
- **A) Ja, som nu** — med localStorage fallback og DEFAULT_INTERESTS
- **B) Ja, men med signup-prompt** — "Opret konto for personlige nyheder"
- **C) Nej** — tab kræver login, erstattes af "Opret konto" CTA

**Anbefaling:** **B** — behold tab'en men vis en subtil signup-prompt. Det giver anonyme brugere en forsmag og motiverer signup.

### ❓ Beslutning 4: Google login i fase 1?
Google login kræver opsætning i Google Cloud Console (OAuth consent screen, credentials). Det tager 30-60 min ekstra.

**Anbefaling:** Vent til **Fase 6**. Email+password er fint til start.

### ❓ Beslutning 5: Hvornår skal custom Grok-søgninger køre?
**Muligheder:**
- **A) Hver cron-kørsel (hvert 30 min)** — friskest data, men dyrere
- **B) Hver 2. time** — billigere, stadig rimelig friskt
- **C) Kun når brugere tilføjer nye emner** — mest effektivt, men komplekst

**Anbefaling:** **A** men med caching — kør kun søgningen hvis resultatet er >30 min gammelt. Effektivt og simpelt.

---

## 9. Estimeret indsats

| Fase | Beskrivelse | Estimat | Prioritet |
|------|-------------|---------|-----------|
| 1 | Auth Foundation | 2-3 dage | 🔴 Kritisk |
| 2 | Onboarding & Interesser | 2 dage | 🔴 Kritisk |
| 3 | Personaliseret Feed | 2-3 dage | 🔴 Kritisk |
| 4 | Dynamisk Nyhedsopdagelse | 2-3 dage | 🟡 Vigtig |
| 5 | Polish & Edge Cases | 1-2 dage | 🟢 Nice-to-have |
| 6 | Social Login & Avanceret | 2-3 dage | ⚪ Fremtidig |
| **Total Fase 1-4** | **MVP med full funktionalitet** | **8-11 dage** | |
| **Total Fase 1-5** | **Production-ready** | **9-13 dage** | |

### Dependencies & risici

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Grok API costs stiger med custom emner | 💰 Middel | Max 20 custom søgninger, caching |
| Spam/misbrug af custom emner | 🔴 Lav | Rate limiting, max 10 per bruger |
| Supabase Auth issues | 🟡 Lav | Velmodnet produkt, god dokumentation |
| RLS policies blokerer data | 🔴 Middel | Test grundigt i development |

### Nye dependencies

```bash
npm install @supabase/ssr
# @supabase/supabase-js er allerede installeret
```

### Nye env-variabler

```env
# Browser-side (public)
NEXT_PUBLIC_SUPABASE_URL=https://nzmhfborsapbnlckufrx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<fra Supabase Dashboard>

# Eksisterende (server-side) - allerede konfigureret
SUPABASE_URL=https://nzmhfborsapbnlckufrx.supabase.co
SUPABASE_ANON_KEY=<...>
SUPABASE_SERVICE_ROLE_KEY=<...>
```

---

## Opsummering

| Emne | Anbefaling |
|------|------------|
| **Auth** | Supabase Auth, email+password, ingen verifikation |
| **Database** | 3 nye tabeller: user_profiles, interests, user_interests |
| **Custom emner** | Bruger skriver emne → gemmes i interests → Grok søger → artikler genereres |
| **Filtrering** | Hybrid: server-side SQL for hovedquery, client-side for real-time toggle |
| **Anonyme brugere** | Uændret oplevelse med subtil signup-prompt |
| **Grok costs** | +$5-20/måned afhængigt af antal unikke custom emner |
| **Ny dependency** | Kun `@supabase/ssr` |
| **MVP estimat** | 8-11 arbejdsdage |

---

*Forslag udarbejdet af Nova. Spørg endelig ind til detaljer! 🚀*
