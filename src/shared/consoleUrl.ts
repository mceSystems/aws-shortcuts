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

/** Feature-level key. Drops the resource id and trailing route segments
 *  so EC2 i-aaa and EC2 i-bbb collapse to the same bucket.
 *
 *  Patterns:
 *    A. Hash route form `#/segment/...` → keep `#/segment` only.
 *    B. Anchor form `#Anchor:key=val` or `#Anchor?…` → keep `#Anchor:` (or `#Anchor?`).
 *  This aligns with the catalog's `feature.path` shape. */
export function featureDedupeKey(consolePath: string): string {
  const hashIdx = consolePath.indexOf('#');
  const beforeHash = hashIdx === -1 ? consolePath : consolePath.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : consolePath.slice(hashIdx);
  const qIdx = beforeHash.indexOf('?');
  const path = qIdx === -1 ? beforeHash : beforeHash.slice(0, qIdx);

  if (!hash) return path;

  if (hash.startsWith('#/')) {
    const rest = hash.slice(2);
    const slashIdx = rest.indexOf('/');
    const ques = rest.indexOf('?');
    let endIdx = -1;
    if (slashIdx === -1) endIdx = ques;
    else if (ques === -1) endIdx = slashIdx;
    else endIdx = Math.min(slashIdx, ques);
    if (endIdx === -1) return path + hash;
    return path + '#/' + rest.slice(0, endIdx);
  }

  const colon = hash.indexOf(':');
  const ques = hash.indexOf('?');
  let sepIdx = -1;
  if (colon === -1) sepIdx = ques;
  else if (ques === -1) sepIdx = colon;
  else sepIdx = Math.min(colon, ques);
  if (sepIdx === -1) return path + hash;
  return path + hash.slice(0, sepIdx + 1);
}

/** Auth/session/tracking params we strip when storing a favorite. AWS
 *  console seeds these on portal redirect; they're meaningless on next
 *  launch and clutter the saved URL. Everything else is preserved. */
const AUTH_PARAM_RE =
  /^(nc2|icmpid|hashArgs|orgId|signin_token|x-amz-sso-token|token|code|state|response_type|client_id|client_secret|redirect_uri|session|identity|trk|sc_channel|sc_campaign|sc_publisher|sc_geo|sc_country|sc_outcome)$/i;

function stripAuthParams(qs: string): string {
  if (!qs) return qs;
  const params = new URLSearchParams(qs);
  const keep: [string, string][] = [];
  for (const [k, v] of params) {
    if (AUTH_PARAM_RE.test(k)) continue;
    keep.push([k, v]);
  }
  if (keep.length === params.size) return qs;
  const out = new URLSearchParams();
  for (const [k, v] of keep) out.append(k, v);
  return out.toString();
}

/** Sanitize a consolePath for storage in a favorite. Keeps all routing,
 *  resource bindings, and view params; drops only known auth/session/
 *  tracking params from both the top-level query AND any hash query. */
export function sanitizeConsolePathForFavorite(consolePath: string): string {
  const hashIdx = consolePath.indexOf('#');
  const beforeHash = hashIdx === -1 ? consolePath : consolePath.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : consolePath.slice(hashIdx);

  // Top-level query.
  const qIdx = beforeHash.indexOf('?');
  const path = qIdx === -1 ? beforeHash : beforeHash.slice(0, qIdx);
  const topQs = qIdx === -1 ? '' : beforeHash.slice(qIdx + 1);
  const cleanTop = stripAuthParams(topQs);

  // Hash query — AWS uses two patterns: `#Anchor:k=v&k=v` and `#/route?k=v&k=v`.
  let cleanHash = hash;
  if (hash) {
    const hashColon = hash.indexOf(':');
    const hashQues = hash.indexOf('?');
    let sepIdx = -1;
    let sepChar = '';
    if (hashColon === -1 && hashQues === -1) {
      cleanHash = hash;
    } else {
      if (hashColon === -1) {
        sepIdx = hashQues;
        sepChar = '?';
      } else if (hashQues === -1) {
        sepIdx = hashColon;
        sepChar = ':';
      } else if (hashColon < hashQues) {
        sepIdx = hashColon;
        sepChar = ':';
      } else {
        sepIdx = hashQues;
        sepChar = '?';
      }
      const head = hash.slice(0, sepIdx + 1);
      const tail = hash.slice(sepIdx + 1);
      const cleanTail = stripAuthParams(tail);
      cleanHash = cleanTail ? head + cleanTail : hash.slice(0, sepIdx);
      // If the separator was `:` and tail was wiped clean, keep the `:`
      // so AWS recognizes the anchor form (it expects `#Anchor:` even
      // when there are no kvs).
      if (sepChar === ':' && !cleanTail) cleanHash = hash.slice(0, sepIdx + 1);
    }
  }

  return path + (cleanTop ? '?' + cleanTop : '') + cleanHash;
}

/** Full dedupe key scoped to a launch context. Feature-level — same
 *  resource id collapses, but different account/role/region remains
 *  distinct. */
export function fullDedupeKey(input: {
  accountId: string;
  roleName: string;
  region: string;
  consolePath: string;
}): string {
  return `${input.accountId}|${input.roleName}|${input.region}|${featureDedupeKey(input.consolePath)}`;
}
