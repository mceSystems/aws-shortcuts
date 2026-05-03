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

/** Dedupe key for "recently closed" entries.
 *
 *  Strips top-level query (already volatile / region only). In the hash,
 *  keeps up to the first `key=value` binding when separated by `:` (the
 *  AWS resource-binding form, e.g. `#InstanceDetails:instanceId=i-123`),
 *  and drops the entire hash query when separated by `?` (the modern
 *  router form, e.g. `#/dashboard/foo?start=NOW-1h` → drop `?…`).
 *
 *  Result: same resource id collapses across volatile view state, but
 *  distinct resource ids stay distinct. */
export function dedupeKeyFromConsolePath(consolePath: string): string {
  const hashIdx = consolePath.indexOf('#');
  const beforeHash = hashIdx === -1 ? consolePath : consolePath.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : consolePath.slice(hashIdx);
  const qIdx = beforeHash.indexOf('?');
  const path = qIdx === -1 ? beforeHash : beforeHash.slice(0, qIdx);

  if (!hash) return path;

  const colon = hash.indexOf(':');
  const ques = hash.indexOf('?');
  if (colon === -1 && ques === -1) return path + hash;

  let sepIdx: number;
  let sepChar: ':' | '?';
  if (colon === -1) {
    sepIdx = ques;
    sepChar = '?';
  } else if (ques === -1) {
    sepIdx = colon;
    sepChar = ':';
  } else if (colon < ques) {
    sepIdx = colon;
    sepChar = ':';
  } else {
    sepIdx = ques;
    sepChar = '?';
  }

  if (sepChar === '?') {
    return path + hash.slice(0, sepIdx);
  }
  const anchorAndSep = hash.slice(0, sepIdx + 1);
  const rest = hash.slice(sepIdx + 1);
  const ampIdx = rest.indexOf('&');
  const firstKv = ampIdx === -1 ? rest : rest.slice(0, ampIdx);
  return path + anchorAndSep + firstKv;
}

/** Full dedupe key scoped to a launch context. Same resource under
 *  a different account/role/region is a different bucket. */
export function fullDedupeKey(input: {
  accountId: string;
  roleName: string;
  region: string;
  consolePath: string;
}): string {
  return `${input.accountId}|${input.roleName}|${input.region}|${dedupeKeyFromConsolePath(input.consolePath)}`;
}
