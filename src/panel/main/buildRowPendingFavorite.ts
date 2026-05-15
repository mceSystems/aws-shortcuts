import type { Account } from '@/shared/types';
import { sanitizeConsolePathForFavorite } from '@/shared/consoleUrl';
import { findServiceById } from '@/shared/serviceCatalog';
import type { PendingFavorite } from './SaveFavoriteBanner';

type RowInput = {
  /** When the row's identityCenterId is known (favorites, freshly-recorded
   * recents), it pins which IdC the favorite launches under. Empty string
   * means "let SW resolve by accountId+role" — used for legacy recents
   * recorded before the multi-IdC switch. */
  identityCenterId?: string;
  accountId: string;
  roleName: string;
  region: string;
  serviceId: string;
  consolePath: string;
};

/** Build a PendingFavorite from an Open or Recent row.
 *  - consolePath is sanitized: auth/session/tracking params stripped,
 *    everything else preserved (resource id, view state, query, hash).
 *  - default label: `<account> · <service> · <feature?> · <resource?>`. */
export function buildRowPendingFavorite(
  row: RowInput,
  accounts: Account[],
): PendingFavorite | null {
  const account = accounts.find((a) => a.accountId === row.accountId);
  const accountLabel = account?.alias || account?.name || row.accountId;
  const service = findServiceById(row.serviceId);
  const serviceName = service?.name ?? row.serviceId.toUpperCase();

  const sanitized = sanitizeConsolePathForFavorite(row.consolePath);

  const matched = matchFeature(service, sanitized);
  let featureName: string | undefined = matched?.name;
  let featurePath: string | undefined = matched?.path;
  let hintPrefix = matched?.path ?? '';
  if (!featureName) {
    const derived = deriveFeatureFromUrl(sanitized, row.serviceId);
    if (derived) {
      featureName = derived.name;
      hintPrefix = derived.consumed;
    }
  }
  const resource = hintPrefix ? extractResourceHint(sanitized, hintPrefix) : undefined;

  const labelParts = [accountLabel, serviceName];
  if (featureName) labelParts.push(featureName);
  if (resource) labelParts.push(resource);

  return {
    defaultLabel: labelParts.join(' · '),
    identityCenterId: row.identityCenterId || account?.identityCenterId || '',
    accountId: row.accountId,
    roleName: row.roleName,
    region: row.region,
    serviceId: row.serviceId,
    featurePath,
    consolePath: sanitized,
  };
}

// Below: same helpers as TabRow's, kept here so a single module owns the
// favorite-shape derivation. TabRow stays presentational.

function matchFeature(
  service: ReturnType<typeof findServiceById>,
  consolePath: string,
): { name: string; path: string } | undefined {
  if (!service?.features) return undefined;
  const sorted = [...service.features].sort((a, b) => b.path.length - a.path.length);
  for (const f of sorted) {
    if (consolePath.startsWith(f.path)) return { name: f.name, path: f.path };
  }
  return undefined;
}

function deriveFeatureFromUrl(
  consolePath: string,
  serviceId: string,
): { name: string; consumed: string } | undefined {
  const hashIdx = consolePath.indexOf('#');
  if (hashIdx !== -1) {
    const beforeHash = consolePath.slice(0, hashIdx);
    const hash = consolePath.slice(hashIdx);
    if (hash.startsWith('#/')) {
      const m = /^#\/([^/?&]+)/.exec(hash);
      if (m) return { name: prettify(m[1]), consumed: beforeHash + '#/' + m[1] };
    } else if (hash.length > 1) {
      const m = /^#([^:?&/]+)/.exec(hash);
      if (m) return { name: prettify(m[1]), consumed: beforeHash + '#' + m[1] };
    }
    return undefined;
  }
  const path = consolePath.replace(/^\/+/, '');
  let parts = path.split('?')[0].split('/').filter(Boolean);
  if (parts[0] === serviceId) parts = parts.slice(1);
  while (parts.length > 0 && (parts[0] === 'home' || parts[0] === 'v2')) {
    parts = parts.slice(1);
  }
  if (parts.length === 0) return undefined;
  const featureSeg = parts[0];
  const allParts = path.split('/');
  const idx = allParts.indexOf(featureSeg);
  return { name: prettify(featureSeg), consumed: allParts.slice(0, idx + 1).join('/') };
}

const MAX_HINT_LEN = 32;

function extractResourceHint(consolePath: string, prefix: string): string | undefined {
  let remainder = consolePath.startsWith(prefix)
    ? consolePath.slice(prefix.length)
    : consolePath;
  remainder = remainder.replace(/^[#&]/, '');
  if (!remainder) return undefined;

  const slashMatch = /^\/([^?#&/]+)/.exec(remainder);
  if (slashMatch) return shorten(decode(slashMatch[1]));

  const kvMatch = /^[:?]?[A-Za-z][A-Za-z0-9_-]*=([^&]+)/.exec(remainder);
  if (kvMatch) return shorten(decode(kvMatch[1]));

  return undefined;
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function shorten(s: string): string {
  if (s.length <= MAX_HINT_LEN) return s;
  return s.slice(0, MAX_HINT_LEN - 1) + '…';
}

function prettify(s: string): string {
  const spaced = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
