import type { Account } from '@/shared/types';
import { chipColor } from '@/shared/colors';
import { findServiceById } from '@/shared/serviceCatalog';
import { ServiceIcon } from './ServiceIcon';
import styles from './TabRow.module.css';

type Props = {
  serviceId: string;
  consolePath: string;
  account?: Account;
  accountFallbackId: string;
  roleName: string;
  region: string;
  title?: string;
  /** When set, primary line shows this label verbatim (used by Favorites). */
  label?: string;
  onClick: () => void;
  trailing?: React.ReactNode;
};

export function TabRow({
  serviceId,
  consolePath,
  account,
  accountFallbackId,
  roleName,
  region,
  title,
  label,
  onClick,
  trailing,
}: Props) {
  const service = findServiceById(serviceId);
  const serviceName = service?.name ?? serviceId.toUpperCase();
  const matched = matchFeature(service, consolePath);
  let featureName: string | undefined = matched?.name;
  let hintPrefix: string = matched?.path ?? '';
  if (!featureName) {
    const derived = deriveFeatureFromUrl(consolePath, serviceId);
    if (derived) {
      featureName = derived.name;
      hintPrefix = derived.consumed;
    }
  }
  const resourceHint = hintPrefix
    ? extractResourceHint(consolePath, hintPrefix)
    : undefined;
  const accountLabel = account?.alias || account?.name || accountFallbackId;
  const color = chipColor(account?.color);
  const isNeutral = !account?.color;

  const parts = [serviceName, featureName, resourceHint].filter(Boolean) as string[];
  const breadcrumb = parts.join(' · ');
  const primary = label?.trim() ? label : breadcrumb;
  const titleHint = title?.trim() ? title : breadcrumb;

  return (
    <div
      role="button"
      tabIndex={0}
      className={[styles.row, isNeutral ? styles.neutral : ''].filter(Boolean).join(' ')}
      style={{ ['--row-color' as string]: color }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      title={titleHint}
    >
      <span className={styles.stripe} />
      <ServiceIcon id={serviceId} name={serviceName} fallbackBg={color} size={18} />
      <div className={styles.text}>
        <span className={styles.primary}>{primary}</span>
        <span className={styles.secondary}>
          {accountLabel}
          {roleName ? ` · ${roleName}` : ''}
          {region ? ` · ${region}` : ''}
        </span>
      </div>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}

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

/** Fallback when the catalog has no matching feature. Pulls a feature
 *  name from the hash anchor or the first path segment after the service
 *  prefix. Returns the chunk it consumed so the resource-hint extractor
 *  can scan the remainder. */
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
      if (m) {
        return { name: prettify(m[1]), consumed: beforeHash + '#/' + m[1] };
      }
    } else if (hash.length > 1) {
      const m = /^#([^:?&/]+)/.exec(hash);
      if (m) {
        return { name: prettify(m[1]), consumed: beforeHash + '#' + m[1] };
      }
    }
    return undefined;
  }
  // No hash — look at first non-trivial path segment after the service.
  const path = consolePath.replace(/^\/+/, '');
  let parts = path.split('?')[0].split('/').filter(Boolean);
  if (parts[0] === serviceId) parts = parts.slice(1);
  while (parts.length > 0 && (parts[0] === 'home' || parts[0] === 'v2')) {
    parts = parts.slice(1);
  }
  if (parts.length === 0) return undefined;
  const featureSeg = parts[0];
  const consumedSegments = path.split('/').slice(0, path.split('/').indexOf(featureSeg) + 1);
  return { name: prettify(featureSeg), consumed: consumedSegments.join('/') };
}

function prettify(s: string): string {
  // CamelCase split + capitalize-first.
  const spaced = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const MAX_HINT_LEN = 32;

/** Extract a short resource label from the path remainder beyond `prefix`.
 *  Handles two AWS hash conventions:
 *    A. trailing slash segment: `lambda/home#/functions/myFn` → `myFn`
 *    B. first key=value pair after `:` or `?`: `ec2/home#InstanceDetails:instanceId=i-123` → `i-123`
 *  Returns undefined if no useful identifier is present. */
function extractResourceHint(consolePath: string, prefix: string): string | undefined {
  let remainder = consolePath.startsWith(prefix)
    ? consolePath.slice(prefix.length)
    : consolePath;
  // Strip leading separators that aren't part of the identifier itself.
  remainder = remainder.replace(/^[#&]/, '');
  if (!remainder) return undefined;

  // Pattern A: /name (route param)
  const slashMatch = /^\/([^?#&/]+)/.exec(remainder);
  if (slashMatch) return shorten(decode(slashMatch[1]));

  // Pattern B: :key=value or ?key=value or bare key=value
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
