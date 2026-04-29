// Fuzzy match scoring. Higher = better. Returns null when no signal.

export function scoreMatch(query: string, ...fields: string[]): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  let best = -1;
  for (const raw of fields) {
    if (!raw) continue;
    const s = raw.toLowerCase();
    const score = scoreOne(q, s);
    if (score > best) best = score;
  }
  return best > 0 ? best : null;
}

function scoreOne(q: string, s: string): number {
  if (s === q) return 100;
  if (s.startsWith(q)) return 80;
  const initials = s
    .split(/[^a-z0-9]+/)
    .map((w) => w.charAt(0))
    .join('');
  if (initials === q) return 70;
  if (initials.startsWith(q)) return 60;
  if (s.includes(q)) return 50;
  // Subsequence match: every char of q appears in s in order, with gap penalty.
  let qi = 0;
  let lastIdx = -1;
  let gapPenalty = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      if (lastIdx >= 0) gapPenalty += i - lastIdx - 1;
      lastIdx = i;
      qi++;
    }
  }
  if (qi === q.length) {
    return Math.max(10, 40 - Math.min(30, gapPenalty));
  }
  return 0;
}
