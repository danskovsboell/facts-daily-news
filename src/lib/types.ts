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
  grokCategory?: Category;
  grokSubCategory?: SubCategory;
  isGossip?: boolean;
  region?: string;
}

export interface FactCheckResult {
  score: number; // 0-100
  summary: string;
  claims: Claim[];
  sources?: string[];
  category?: string;
  checkedAt: string;
  // Enhanced fact-check fields
  sourcesConsulted?: number;       // Total number of web sources checked
  sourceLinks?: SourceLink[];      // Actual source URLs with titles
  verificationMethod?: 'web-search' | 'ai-only'; // How the check was performed
}

export interface SourceLink {
  url: string;
  title?: string;
  domain?: string;
}

export interface Claim {
  text: string;
  verdict: 'true' | 'mostly-true' | 'mixed' | 'mostly-false' | 'false' | 'unverified';
  explanation: string;
  claimSources?: SourceLink[];  // Per-claim source links
}

export type Category = 'danmark' | 'europa' | 'verden' | 'sladder';
export type TabId = 'dine-nyheder' | Category;
export type SubCategory = 'generelt' | 'finans';

export interface UserSettings {
  interests: string[];
  darkMode: boolean;
  language: string;
}

export interface TabItem {
  id: TabId;
  label: string;
  icon?: string;
}

export interface SubTabItem {
  id: SubCategory;
  label: string;
}

export interface GrokCategorizationResult {
  category: Category;
  subCategory: SubCategory;
  region: string;
  isGossip: boolean;
  confidence: number;
}

// ============================================================
// V2: Article types
// ============================================================

export interface ArticleSource {
  title: string;
  url: string;
  source_name: string;
}

export interface ArticleFactDetails {
  claims: Claim[];
  sources_checked: string[];
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: Category;
  sub_category: SubCategory;
  fact_score: number;
  fact_details: ArticleFactDetails | null;
  interest_tags: string[];
  sources: ArticleSource[];
  is_gossip: boolean;
  created_at: string;
  updated_at: string;
  published: boolean;
}

export interface RawSource {
  id: string;
  title: string;
  description: string;
  url: string;
  source_name: string;
  published_at: string;
  fetched_at: string;
  category: Category;
  sub_category: SubCategory;
  raw_content: string;
  processed: boolean;
}
