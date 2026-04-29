import { Logo } from '../components/Logo';
import styles from './Header.module.css';

type Props = {
  onSettings?: () => void;
  onRefresh?: () => void;
  onPalette?: () => void;
};

export function Header({ onSettings, onRefresh, onPalette }: Props) {
  return (
    <header className={styles.header}>
      <span className={styles.brand}>
        <Logo size={22} />
        <span className={styles.title}>AWS Shortcut</span>
      </span>
      <span className={styles.spacer} />
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onPalette}
        title="Open command palette (Cmd+K)"
      >
        ⌘K
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onRefresh}
        title="Refresh accounts"
      >
        ↻
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onSettings}
        title="Settings"
      >
        ⚙
      </button>
    </header>
  );
}
