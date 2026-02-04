import { TabItem, SubTabItem } from './types';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Facts on Daily News';

export const TABS: TabItem[] = [
  { id: 'dine-nyheder', label: '⭐ Dine Nyheder' },
  { id: 'danmark', label: '🇩🇰 Danmark' },
  { id: 'europa', label: '🇪🇺 Europa' },
  { id: 'verden', label: '🌍 Verden' },
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

export const FACT_SCORE_COLORS = {
  high: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },    // 80-100
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' }, // 50-79
  low: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },           // 0-49
  unknown: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};
