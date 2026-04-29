export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'eu-south-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-south-1',
  'sa-east-1',
  'ca-central-1',
  'me-south-1',
  'af-south-1',
] as const;

export function pickRegionSuggestion(
  observed: { region: string; hits: number; lastSeenAt: number }[] | undefined,
  dismissed: string[] | undefined,
): { region: string; hits: number } | undefined {
  if (!observed || observed.length === 0) return undefined;
  const skip = new Set(dismissed ?? []);
  const candidates = observed
    .filter((o) => !skip.has(o.region))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  if (candidates.length === 0) return undefined;
  return { region: candidates[0].region, hits: candidates[0].hits };
}
