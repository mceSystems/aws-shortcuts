import { useEffect, useState } from 'react';
import { getIcon, subscribeIcons } from '@/shared/iconStore';
import styles from './ServiceIcon.module.css';

type Props = {
  id: string;
  name: string;
  fallbackBg: string;
  size?: number;
};

export function ServiceIcon({ id, name, fallbackBg, size = 22 }: Props) {
  // Re-render when icons store updates (catalog refresh wrote a fresh icons.json).
  const [, setTick] = useState(0);
  useEffect(() => subscribeIcons(() => setTick((n) => n + 1)), []);

  const url = getIcon(id);
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
