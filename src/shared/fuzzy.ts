export type FuzzyHit<T> = {
  item: T;
  score: number;
};

export function fuzzyMatch(needle: string, haystack: string): number {
  if (!needle) return 1;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (h.includes(n)) return 100 - h.indexOf(n);
  let ni = 0;
  let score = 0;
  let lastMatchIdx = -1;
  for (let i = 0; i < h.length && ni < n.length; i++) {
    if (h[i] === n[ni]) {
      score += lastMatchIdx === i - 1 ? 5 : 1;
      lastMatchIdx = i;
      ni++;
    }
  }
  return ni === n.length ? score : 0;
}

export function fuzzyFilter<T>(
  needle: string,
  items: T[],
  toString: (item: T) => string,
): FuzzyHit<T>[] {
  if (!needle) return items.map((item) => ({ item, score: 0 }));
  return items
    .map((item) => ({ item, score: fuzzyMatch(needle, toString(item)) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);
}
