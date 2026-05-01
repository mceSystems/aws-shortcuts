import { useEffect, useState } from 'react';
import { ICONS } from '@/assets/icons';
import { getCachedIconUrl, subscribeIconCache } from '@/shared/iconCache';
import styles from './ServiceIcon.module.css';

type Props = {
  id: string;
  name: string;
  fallbackBg: string;
  size?: number;
};

export function ServiceIcon({ id, name, fallbackBg, size = 22 }: Props) {
  // Resolve once per render but re-render whenever the runtime icon cache
  // changes (e.g. SW just finished fetching a freshly-added service icon).
  const [, setTick] = useState(0);
  useEffect(() => subscribeIconCache(() => setTick((n) => n + 1)), []);

  const url = getCachedIconUrl(id) ?? ICONS[id];
  if (url) {
    return (
      <span className={styles.iconBox} style={{ width: size, height: size }}>
        <img src={url} alt="" width={size} height={size} className={styles.svg} />
      </span>
    );
  }
  return (
    <span
      className={styles.fallback}
      style={{ background: fallbackBg, width: size, height: size }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  );
}
