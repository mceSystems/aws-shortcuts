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

export function awsColorToChromeGroupColor(
  hexOrName: string | undefined,
): chrome.tabGroups.ColorEnum {
  if (!hexOrName) return 'grey';
  const lower = hexOrName.trim().toLowerCase();
  // Reverse-lookup hex → AWS color name first; fall back to direct name match.
  const nameFromHex = Object.entries(AWS_COLOR_MAP).find(
    ([, hex]) => hex.toLowerCase() === lower,
  )?.[0];
  switch (nameFromHex ?? lower) {
    case 'red': return 'red';
    case 'orange': return 'orange';
    case 'yellow': return 'yellow';
    case 'green': return 'green';
    case 'teal': return 'cyan';
    case 'blue': return 'blue';
    case 'purple': return 'purple';
    case 'pink': return 'pink';
    default: return 'grey';
  }
}
