export interface NewsItem {
  id: string;
  title: string;
  description: string;
  content?: string;
  link: string;
  pubDate: string;
  source: string;
  sourceUrl: string;
  category: Category;
  subCategory: SubCategory;
  factScore?: number;
  factDetails?: FactCheckResult;
  imageUrl?: string;
}

export interface FactCheckResult {
  score: number; // 0-100
  summary: string;
  claims: Claim[];
  checkedAt: string;
}

export interface Claim {
  text: string;
  verdict: 'true' | 'mostly-true' | 'mixed' | 'mostly-false' | 'false' | 'unverified';
  explanation: string;
}

export type Category = 'danmark' | 'europa' | 'verden' | 'sladder';
export type SubCategory = 'generelt' | 'finans';

export interface FeedSource {
  name: string;
  url: string;
  category: Category;
  subCategory: SubCategory;
  language: string;
  logoUrl?: string;
}

export interface UserSettings {
  interests: string[];
  darkMode: boolean;
  language: string;
}

export interface TabItem {
  id: Category;
  label: string;
  icon?: string;
}

export interface SubTabItem {
  id: SubCategory;
  label: string;
}
