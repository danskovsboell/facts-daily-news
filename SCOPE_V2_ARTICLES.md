# Facts on Daily News – V2: AI-Generated Articles

## Oversigt
Opgradér Facts on Daily News fra en nyhedsaggregator til en AI-drevet nyhedsplatform der genererer originale artikler baseret på nyhedskilder.

## Nuværende tilstand (V1)
- RSS feeds + NewsAPI + Mediastack henter nyheder
- Grok fakta-checker og kategoriserer nyheder
- UI viser nyhedsoverskrifter med fakta-scores og kildelinks
- Live: https://facts-daily-news.vercel.app

## Mål (V2)
Transformér fra "links til andres nyheder" → "originale artikler skrevet af AI"

## Artikel-Pipeline

```
RSS/NewsAPI/Mediastack → Rå nyhedsdata → Supabase (raw_sources)
                                              ↓
                                    Grok analyserer og grupperer
                                    (samler 2-5 kilder om samme emne)
                                              ↓
                                    Grok skriver original artikel
                                    (baseret på alle kilder, fakta-tjekket)
                                              ↓
                                    Supabase (articles) med metadata:
                                    - titel, brødtekst, opsummering
                                    - fakta-score (0-100)
                                    - kategori (region + type)
                                    - kilder (links til originaler)
                                    - interesseområde-tags
                                    - tidsstempel
                                              ↓
                                    UI viser færdige artikler
```

## Database Schema (Supabase)

### Tabel: raw_sources
```sql
CREATE TABLE raw_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  category TEXT, -- danmark, europa, verden
  sub_category TEXT, -- generelt, finans
  raw_content TEXT,
  processed BOOLEAN DEFAULT false
);
```

### Tabel: articles
```sql
CREATE TABLE articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL, -- kort opsummering til kort-visning
  body TEXT NOT NULL, -- fuld artikel i markdown
  category TEXT NOT NULL, -- danmark, europa, verden, sladder
  sub_category TEXT DEFAULT 'generelt', -- generelt, finans
  fact_score INTEGER CHECK (fact_score >= 0 AND fact_score <= 100),
  fact_details JSONB, -- { claims: [...], sources_checked: [...] }
  interest_tags TEXT[], -- tesla, ai, grøn-energi, etc.
  sources JSONB NOT NULL, -- [{ title, url, source_name }]
  is_gossip BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published BOOLEAN DEFAULT true
);
```

### Tabel: user_interests (V2.1 - auth)
```sql
CREATE TABLE user_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  interests TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## API Endpoints

### GET /api/articles
- Henter artikler fra Supabase (pagineret)
- Filtrerer på category, sub_category, interest_tags
- Sorterer efter created_at (nyeste først)

### POST /api/articles/generate (intern, cron-triggered)
- Henter nye raw_sources der ikke er processed
- Grupperer relaterede kilder
- Sender til Grok for artikelgenerering
- Gemmer færdige artikler i Supabase

### GET /api/articles/[id]
- Henter enkelt artikel med fulde detaljer

### POST /api/sources/fetch (intern, cron-triggered)
- Henter nye nyheder fra RSS/NewsAPI/Mediastack
- Gemmer i raw_sources

## Vercel Cron Jobs

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/sources/fetch",
      "schedule": "*/30 * * * *"  // Hvert 30. minut
    },
    {
      "path": "/api/articles/generate",
      "schedule": "*/15 * * * *"  // Hvert 15. minut
    }
  ]
}
```

## UI Ændringer

### Artikel-kort (ArticleCard)
- Titel (klikbar → fuld artikel)
- Kort opsummering (2-3 linjer)
- Fakta-score badge
- Kildeantal ("Baseret på 3 kilder")
- Interesse-tags
- Tidsstempel

### Artikel-side (/article/[id])
- Fuld artikel i pæn typografi
- Fakta-score med detaljer (klik for at se tjek)
- Kilder-sektion i bunden (links til originale artikler)
- "Baseret på" kilder med links
- Relaterede artikler

### Dashboard
- Beholde eksisterende tabs (Danmark/Europa/Verden/Sladder)
- Under-tabs (Generelt/Finans & Business)
- Interesseområder vises som prioriterede artikler øverst
- Infinite scroll eller "Indlæs mere" knap

## Grok Prompt til Artikelgenerering

```
Du er en professionel nyhedsjournalist. Skriv en original dansk artikel baseret på følgende kilder.

REGLER:
- Skriv på dansk
- Vær objektiv og faktuel
- Brug dine egne formuleringer – kopier IKKE direkte fra kilderne
- Inkluder alle vigtige fakta fra kilderne
- Angiv aldrig at du er en AI
- Artiklen skal have: overskrift, kort opsummering (1-2 sætninger), og brødtekst
- Fakta-tjek alle påstande mod kilderne og giv en samlet score 0-100

KILDER:
[indsæt kilder her]

SVAR I JSON FORMAT:
{
  "title": "...",
  "summary": "...",
  "body": "...",  // markdown format
  "fact_score": 85,
  "fact_details": { "claims": [...], "sources_checked": [...] },
  "category": "danmark|europa|verden|sladder",
  "sub_category": "generelt|finans",
  "interest_tags": ["ai", "tesla", ...],
  "is_gossip": false
}
```

## Tekniske Beslutninger
- **Ingen billeder i V2** – kun tekst-artikler (billeder i V3)
- **Supabase som database** – Dan opretter projekt
- **Grok-3-mini-fast** til kategorisering, **grok-3-mini** til artikelskrivning
- **Cache/deduplication** – tjek URL i raw_sources for at undgå dubletter
- **Rate limiting** – max 50 artikler genereret per time
- **Fallback** – hvis Supabase ikke er konfigureret, brug eksisterende RSS-flow

## Environment Variables (tilføjes)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Token-estimat
- Artikelgenerering: ~2000 input + ~1500 output tokens per artikel
- 50 artikler/dag × ~3500 tokens = ~175.000 tokens/dag
- Grok-3-mini: $0.30/M input, $0.50/M output
- **~$0.06/dag = ~$1.80/måned** for artikler
- Plus fakta-check: ~$0.03/dag
- **Total: ~$3/måned** 🎉
