// Parse AWS console URLs into the shape used by RESOLVE_LAUNCH_URL.
// Single source of truth for the multi-session subdomain regex; both the
// content script and the service worker import from here.

export const MULTI_SESSION_HOST_RE =
  /^([0-9]{12})-([a-z0-9]+)\.([a-z0-9-]+)\.console\.aws\.amazon\.com$/;

export type ParsedConsoleUrl = {
  accountId?: string;
  sessionSubdomain?: string;
  region: string;
  serviceId: string;
  /** path + query (without `region=`) + hash. Round-trips through
   *  buildPortalLaunchUrl / buildDirectConsoleUrl unchanged. */
  consolePath: string;
  isMultiSession: boolean;
};

export function parseConsoleUrl(url: string): ParsedConsoleUrl | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!u.hostname.endsWith('console.aws.amazon.com')) return null;

  let accountId: string | undefined;
  let sessionSubdomain: string | undefined;
  let region = '';
  let isMultiSession = false;

  const m = MULTI_SESSION_HOST_RE.exec(u.hostname);
  if (m) {
    accountId = m[1];
    sessionSubdomain = m[2];
    region = m[3];
    isMultiSession = true;
  } else {
    // Single-session form: <region>.console.aws.amazon.com or console.aws.amazon.com
    const parts = u.hostname.split('.');
    if (parts.length >= 4 && parts[0] !== 'console') {
      region = parts[0];
    }
  }

  const queryRegion = u.searchParams.get('region');
  if (queryRegion) region = queryRegion;

  const path = u.pathname.replace(/^\/+/, '');
  const serviceId = (path.split('/')[0] ?? '').toLowerCase();

  const params = new URLSearchParams(u.search);
  params.delete('region');
  const qs = params.toString();
  const consolePath = `${path}${qs ? `?${qs}` : ''}${u.hash}`;

  return { accountId, sessionSubdomain, region, serviceId, consolePath, isMultiSession };
}
