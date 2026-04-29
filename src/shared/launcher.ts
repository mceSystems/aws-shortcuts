// Build deep-link URLs for opening AWS console pages via the SSO portal
// shortcut. The portal handles federation + redirect.

type LaunchInput = {
  portalHost: string;
  accountId: string;
  roleName: string;
  region: string;
  consolePath: string;
};

export function buildPortalLaunchUrl({
  portalHost,
  accountId,
  roleName,
  region,
  consolePath,
}: LaunchInput): string {
  const dest = buildConsoleUrl(region, consolePath);
  const qs = new URLSearchParams({
    account_id: accountId,
    role_name: roleName,
    destination: dest,
  });
  return `${portalHost}/start/#/console?${qs.toString()}`;
}

function buildConsoleUrl(region: string, consolePath: string): string {
  // consolePath may already contain a hash (e.g. "ec2/home#Instances:") —
  // append region as a query param BEFORE the hash to keep AWS happy.
  const hashIdx = consolePath.indexOf('#');
  const path = hashIdx === -1 ? consolePath : consolePath.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : consolePath.slice(hashIdx);
  const sep = path.includes('?') ? '&' : '?';
  return `https://${region}.console.aws.amazon.com/${path}${sep}region=${region}${hash}`;
}
