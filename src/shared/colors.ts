export const ACCOUNT_COLORS = [
  '#5A5BFE', // iris
  '#16B8A6', // mint
  '#F59E0B', // amber
  '#EC4899', // rose
  '#8B5CF6', // lilac
  '#06B6D4', // sky
  '#10B981', // sage
  '#F43F5E', // coral
] as const;

export function nextColor(used: string[]): string {
  for (const c of ACCOUNT_COLORS) {
    if (!used.includes(c)) return c;
  }
  return ACCOUNT_COLORS[used.length % ACCOUNT_COLORS.length];
}
