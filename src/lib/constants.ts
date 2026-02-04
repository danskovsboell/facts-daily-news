import { FeedSource, TabItem, SubTabItem } from './types';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Facts on Daily News';

export const TABS: TabItem[] = [
  { id: 'danmark', label: 'Danmark' },
  { id: 'europa', label: 'Europa' },
  { id: 'verden', label: 'Verden' },
  { id: 'sladder', label: 'Sludder & Sladder' },
];

export const SUB_TABS: SubTabItem[] = [
  { id: 'generelt', label: 'Generelt' },
  { id: 'finans', label: 'Finans & Business' },
];

export const DEFAULT_INTERESTS = [
  'Tesla',
  'AI',
  'Grøn Energi',
  'Økonomi & Finans',
  'Renter',
];

export const ALL_INTERESTS = [
  'Tesla',
  'AI',
  'Grøn Energi',
  'Økonomi & Finans',
  'Renter',
  'Politik',
  'Sundhed',
  'Tech',
  'Klima',
  'Krypto',
  'Ejendomme',
  'Sport',
  'Kultur',
  'Videnskab',
  'Startups',
];

export const FEED_SOURCES: FeedSource[] = [
  // ===== DANMARK - Generelt =====
  {
    name: 'DR Nyheder',
    url: 'https://www.dr.dk/nyheder/service/feeds/senestenyt',
    category: 'danmark',
    subCategory: 'generelt',
    language: 'da',
  },
  {
    name: 'TV2 Nyheder',
    url: 'https://feeds.tv2.dk/nyheder/rss',
    category: 'danmark',
    subCategory: 'generelt',
    language: 'da',
  },
  {
    name: 'Berlingske',
    url: 'https://www.berlingske.dk/content/rss',
    category: 'danmark',
    subCategory: 'generelt',
    language: 'da',
  },
  {
    name: 'Politiken',
    url: 'https://politiken.dk/rss/senestenyt.rss',
    category: 'danmark',
    subCategory: 'generelt',
    language: 'da',
  },
  {
    name: 'Jyllands-Posten',
    url: 'https://feeds.jp.dk/jp/seneste',
    category: 'danmark',
    subCategory: 'generelt',
    language: 'da',
  },
  // ===== DANMARK - Finans =====
  {
    name: 'Børsen',
    url: 'https://borsen.dk/rss',
    category: 'danmark',
    subCategory: 'finans',
    language: 'da',
  },
  // ===== EUROPA - Generelt =====
  {
    name: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml',
    category: 'europa',
    subCategory: 'generelt',
    language: 'en',
  },
  {
    name: 'Deutsche Welle',
    url: 'https://rss.dw.com/xml/rss-en-eu',
    category: 'europa',
    subCategory: 'generelt',
    language: 'en',
  },
  {
    name: 'The Guardian Europe',
    url: 'https://www.theguardian.com/world/europe-news/rss',
    category: 'europa',
    subCategory: 'generelt',
    language: 'en',
  },
  // ===== EUROPA - Finans =====
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/rss/home',
    category: 'europa',
    subCategory: 'finans',
    language: 'en',
  },
  // ===== VERDEN - Generelt =====
  {
    name: 'AP News',
    url: 'https://rsshub.app/apnews/topics/apf-topnews',
    category: 'verden',
    subCategory: 'generelt',
    language: 'en',
  },
  {
    name: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'verden',
    subCategory: 'generelt',
    language: 'en',
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'verden',
    subCategory: 'generelt',
    language: 'en',
  },
  // ===== VERDEN - Finans =====
  {
    name: 'Bloomberg',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'verden',
    subCategory: 'finans',
    language: 'en',
  },
  {
    name: 'Reuters Business',
    url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',
    category: 'verden',
    subCategory: 'finans',
    language: 'en',
  },
  // ===== SLADDER =====
  {
    name: 'DR Kultur',
    url: 'https://www.dr.dk/nyheder/service/feeds/kultur',
    category: 'sladder',
    subCategory: 'generelt',
    language: 'da',
  },
];

export const FACT_SCORE_COLORS = {
  high: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },    // 80-100
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' }, // 50-79
  low: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },           // 0-49
  unknown: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};
