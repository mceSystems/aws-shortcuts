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
  onClick,
  trailing,
}: Props) {
  const service = findServiceById(serviceId);
  const serviceName = service?.name ?? serviceId.toUpperCase();
  const feature = matchFeature(service, consolePath);
  const featureName = feature?.name;
  const resourceHint = extractResourceHint(consolePath, feature?.path ?? `${serviceId}/`);
  const accountLabel = account?.alias || account?.name || accountFallbackId;
  const color = chipColor(account?.color);
  const isNeutral = !account?.color;

  const parts = [serviceName, featureName, resourceHint].filter(Boolean) as string[];
  const primary = parts.join(' · ');
  const titleHint = title?.trim() ? title : undefined;

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
