import { Article } from './types';

/** Check if an article matches a single interest tag (fuzzy) */
export function articleMatchesTag(article: Article, tag: string): boolean {
  const tags = (article.interest_tags || []).map((t) => t.toLowerCase());
  if (tags.length === 0) return false;
  const tagLower = tag.toLowerCase();
  return tags.some(
    (t) =>
      t === tagLower || t.includes(tagLower) || tagLower.includes(t)
  );
}

/** Check if an article matches ANY of the given interests */
export function articleMatchesAnyInterest(
  article: Article,
  interests: string[]
): boolean {
  const tags = (article.interest_tags || []).map((t) => t.toLowerCase());
  if (tags.length === 0) return false;
  return interests.some((interest) => {
    const interestLower = interest.toLowerCase();
    return tags.some(
      (tag) =>
        tag === interestLower ||
        tag.includes(interestLower) ||
        interestLower.includes(tag)
    );
  });
}
