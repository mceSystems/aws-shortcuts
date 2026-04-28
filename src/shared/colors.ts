export const ACCOUNT_COLORS = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#10b981', // green
  '#a855f7', // purple
  '#ef4444', // red
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#ec4899', // pink
] as const;

export type AccountColor = (typeof ACCOUNT_COLORS)[number];

export function nextDefaultColor(usedColors: string[]): string {
  for (const c of ACCOUNT_COLORS) {
    if (!usedColors.includes(c)) return c;
  }
  return ACCOUNT_COLORS[usedColors.length % ACCOUNT_COLORS.length];
}
