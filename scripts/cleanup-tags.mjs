#!/usr/bin/env node
/**
 * Cleanup script: Remove incorrect interest_tags from existing articles in Supabase.
 * 
 * Strict rules for each tag - only keep if the article is DIRECTLY and PRIMARILY about the topic.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Set them or use: source .env.local && node scripts/cleanup-tags.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Strict keyword validators for each interest tag
// An article must contain STRONG indicators to keep a tag
const TAG_VALIDATORS = {
  'Tesla': {
    // Must contain strong Tesla-specific terms
    strongKeywords: ['tesla', 'cybertruck', 'model 3', 'model y', 'model s', 'model x', 'supercharger', 'gigafactory', 'tesla-'],
    // Must NOT be generic car/EV articles unless Tesla is specifically mentioned
    requireAny: ['tesla'],
  },
  'AI': {
    strongKeywords: ['kunstig intelligens', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deepmind', 'anthropic', 'copilot', 'gpt-', 'large language model', 'llm', 'generativ ai', 'generative ai', 'ai-model'],
    requireAny: ['ai', 'kunstig intelligens', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'deepmind'],
  },
  'Grøn Energi': {
    strongKeywords: ['vedvarende energi', 'vindmølle', 'vindenergi', 'solenergi', 'solcelle', 'grøn omstilling', 'grøn energi', 'renewable energy', 'wind power', 'solar power', 'green energy', 'offshore wind', 'energiomstilling'],
    requireAny: ['energi', 'vindmølle', 'solcelle', 'vedvarende', 'renewable', 'grøn omstilling'],
    // Explicitly NOT matching
    excludePatterns: ['is på søer', 'zoolog', 'naturbillede', 'dyr', 'dyreliv', 'natur'],
  },
  'Økonomi & Finans': {
    strongKeywords: ['aktie', 'aktiekurs', 'børs', 'c25', 'nasdaq', 'dow jones', 'finansmarked', 'regnskab', 'omsætning', 'overskud', 'underskud', 'bnp', 'gdp', 'inflation', 'handelsbalance', 'valuta', 'euro', 'dollar', 'obligation', 'investering', 'aktiemarked'],
    requireAny: ['aktie', 'børs', 'finans', 'bnp', 'gdp', 'inflation', 'regnskab', 'omsætning', 'investering', 'aktiemarked', 'finansmarked', 'valuta', 'handelsbalance'],
    excludePatterns: ['prince', 'kongelig', 'royal', 'kendte', 'kendis'],
  },
  'Renter': {
    strongKeywords: ['rente', 'rentesats', 'centralbank', 'ecb', 'nationalbanken', 'federal reserve', 'fed ', 'pengepolitik', 'realkreditrente', 'obligationsrente', 'rentebeslutning', 'renteforhøjelse', 'rentenedsættelse', 'boligrente', 'indlånsrente'],
    requireAny: ['rente', 'centralbank', 'ecb', 'nationalbanken', 'pengepolitik', 'realkreditrente'],
  },
};

function shouldKeepTag(tag, title, summary, body) {
  const tagLower = tag.toLowerCase().trim();
  const validator = TAG_VALIDATORS[tag] || TAG_VALIDATORS[Object.keys(TAG_VALIDATORS).find(k => k.toLowerCase() === tagLower)];
  
  if (!validator) {
    // For tags we don't have strict rules for, keep them (Politik, Sport, etc.)
    return true;
  }

  const textToCheck = `${title} ${summary || ''} ${body || ''}`.toLowerCase();

  // Check exclude patterns first
  if (validator.excludePatterns) {
    for (const pattern of validator.excludePatterns) {
      if (textToCheck.includes(pattern.toLowerCase())) {
        return false;
      }
    }
  }

  // Must contain at least one of the required keywords
  if (validator.requireAny) {
    const hasRequired = validator.requireAny.some(kw => textToCheck.includes(kw.toLowerCase()));
    if (!hasRequired) {
      return false;
    }
  }

  return true;
}

async function cleanupTags() {
  console.log('🧹 Starting interest_tags cleanup...\n');

  // Fetch all articles that have interest_tags
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, summary, body, interest_tags')
    .not('interest_tags', 'eq', '{}')
    .not('interest_tags', 'is', null);

  if (error) {
    console.error('Error fetching articles:', error);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log('No articles with interest_tags found.');
    return;
  }

  console.log(`Found ${articles.length} articles with interest_tags.\n`);

  let updatedCount = 0;
  let removedTags = 0;

  for (const article of articles) {
    const currentTags = article.interest_tags || [];
    if (currentTags.length === 0) continue;

    const cleanedTags = currentTags.filter(tag => 
      shouldKeepTag(tag, article.title, article.summary, article.body)
    );

    const removed = currentTags.filter(tag => !cleanedTags.includes(tag));

    if (removed.length > 0) {
      console.log(`📰 "${article.title}"`);
      console.log(`   ❌ Fjerner: ${removed.join(', ')}`);
      if (cleanedTags.length > 0) {
        console.log(`   ✅ Beholder: ${cleanedTags.join(', ')}`);
      } else {
        console.log(`   ✅ Ingen tags tilbage`);
      }
      console.log('');

      const { error: updateError } = await supabase
        .from('articles')
        .update({ interest_tags: cleanedTags })
        .eq('id', article.id);

      if (updateError) {
        console.error(`   ⚠️ Fejl ved opdatering: ${updateError.message}`);
      } else {
        updatedCount++;
        removedTags += removed.length;
      }
    }
  }

  console.log(`\n✅ Færdig! Opdaterede ${updatedCount} artikler, fjernede ${removedTags} forkerte tags.`);
}

cleanupTags().catch(console.error);
