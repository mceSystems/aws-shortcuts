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
  const featureName = matchFeatureName(service, consolePath);
  const accountLabel = account?.alias || account?.name || accountFallbackId;
  const color = chipColor(account?.color);
  const isNeutral = !account?.color;

  const primary = featureName ? `${serviceName} · ${featureName}` : serviceName;
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

function matchFeatureName(
  service: ReturnType<typeof findServiceById>,
  consolePath: string,
): string | undefined {
  if (!service?.features) return undefined;
  const sorted = [...service.features].sort((a, b) => b.path.length - a.path.length);
  for (const f of sorted) {
    if (consolePath.startsWith(f.path)) return f.name;
  }
  return undefined;
}
