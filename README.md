# 📰 Facts on Daily News

AI-drevet nyhedsdashboard med fakta-check via Grok (xAI). Samler nyheder fra danske og internationale kilder og vurderer deres troværdighed med AI.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

## ✨ Features

- 🇩🇰 **Danske nyheder** — DR, TV2, Børsen
- 🇪🇺 **Europæiske nyheder** — Reuters, BBC, The Guardian
- 🌍 **Verdensnyheder** — AP News, Bloomberg
- 🤖 **AI fakta-check** — Troværdighedsscore via Grok (xAI)
- 🏷️ **Interessefiltre** — Tilpas dit feed (Tesla, AI, Grøn Energi, m.m.)
- 📱 **Mobile-first** — Responsivt design med mørkt tema
- ⚡ **Real-time RSS** — Auto-opdatering hvert 5. minut

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 15](https://nextjs.org/) | React framework (App Router) |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS](https://tailwindcss.com/) | Styling |
| [rss-parser](https://github.com/rbren/rss-parser) | RSS feed parsing |
| [Grok (xAI)](https://x.ai/) | AI fact-checking |
| [Vercel](https://vercel.com/) | Hosting & deployment |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone repository
git clone https://github.com/danskovsboell/facts-daily-news.git
cd facts-daily-news

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔑 Environment Variables

Create a `.env.local` file based on `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `GROK_API_KEY` | Nej (V2) | Grok API nøgle til fakta-check |
| `NEWSAPI_KEY` | Nej (V2) | NewsAPI.org nøgle |
| `MEDIASTACK_KEY` | Nej (V2) | Mediastack nøgle |
| `NEXT_PUBLIC_APP_NAME` | Nej | App navn (default: "Facts on Daily News") |

> **Note:** Appen fungerer uden API nøgler! RSS feeds hentes direkte, og fakta-scores vises som demo-værdier.

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout med Header/Footer
│   ├── page.tsx              # Dashboard (hovedside)
│   ├── api/
│   │   ├── news/route.ts     # News API endpoint
│   │   └── factcheck/route.ts # Fact-check API endpoint
│   ├── dashboard/page.tsx    # Dashboard redirect
│   ├── settings/page.tsx     # Brugerindstillinger
│   └── sladder/page.tsx      # Sludder & Sladder sektion
├── components/
│   ├── Header.tsx            # App header
│   ├── Footer.tsx            # App footer
│   ├── TabNavigation.tsx     # Kategori-navigation
│   ├── NewsCard.tsx          # Nyhedskort komponent
│   ├── FactScore.tsx         # Fakta-score badge med detaljer
│   ├── SourceBadge.tsx       # Kilde-badge
│   └── InterestTags.tsx      # Interesse-vælger
├── lib/
│   ├── grok.ts               # Grok API client
│   ├── rss.ts                # RSS feed parser
│   ├── newsapi.ts            # NewsAPI/Mediastack client
│   ├── types.ts              # TypeScript types
│   └── constants.ts          # Feeds, kategorier, config
└── hooks/
    └── useNews.ts            # News data hook
```

## 🗺️ Roadmap

### V1 (Current) ✅
- [x] Next.js + TypeScript + Tailwind setup
- [x] RSS feed parser (DR, TV2, Børsen, BBC, Reuters, AP, Bloomberg)
- [x] Kategori-navigation (Danmark, Europa, Verden, Sladder)
- [x] Under-kategorier (Generelt, Finans & Business)
- [x] NewsCard med kilde og tidspunkt
- [x] FactScore komponent (demo-scores)
- [x] Indstillinger / interesseområder
- [x] Responsivt mobile-first design
- [x] Mørkt farveskema
- [x] Vercel deployment

### V2 (Planned)
- [ ] Grok integration til rigtig fakta-check
- [ ] X/Twitter søgning via Grok
- [ ] AI kategorisering af artikler
- [ ] NewsAPI integration
- [ ] Mediastack integration
- [ ] Push notifications
- [ ] Bruger-auth (login)
- [ ] Gemte artikler / bookmarks
- [ ] Søgefunktion
- [ ] Deling af artikler

### V3 (Future)
- [ ] Personaliseret ML-feed
- [ ] Sentiment analyse
- [ ] Nyhedshistorik og trends
- [ ] Multi-sprog support
- [ ] Browser extension

## 📝 License

MIT

---

Built with ❤️ and AI by [danskovsboell](https://github.com/danskovsboell)
