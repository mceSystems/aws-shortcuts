// AWS console "Account colour" feature uses fixed named swatches.
// We mirror the names → mapped to our token-derived hex values.
// See: AWS console multi-session sidebar.
export const AWS_COLOR_MAP: Record<string, string> = {
  red: '#DC2626',
  orange: '#F59E0B',
  yellow: '#EAB308',
  green: '#10B981',
  teal: '#16B8A6',
  blue: '#5A5BFE',
  purple: '#8B5CF6',
  pink: '#EC4899',
};

export const NEUTRAL_COLOR = '#8A92A0'; // ink-400, intentionally muted

export function awsColorToHex(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return AWS_COLOR_MAP[name.trim().toLowerCase()];
}

export function chipColor(stored: string | undefined): string {
  return stored || NEUTRAL_COLOR;
}
