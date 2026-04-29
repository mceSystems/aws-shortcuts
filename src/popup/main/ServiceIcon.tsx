import { ICONS } from '@/assets/icons';
import styles from './ServiceIcon.module.css';

type Props = {
  id: string;
  name: string;
  fallbackBg: string;
  size?: number;
};

export function ServiceIcon({ id, name, fallbackBg, size = 22 }: Props) {
  const url = ICONS[id];
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
