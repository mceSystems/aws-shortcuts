import styles from './Header.module.css';

type Props = {
  onSettings?: () => void;
  onRefresh?: () => void;
  onOpenPortal?: () => void;
  portalUrl?: string;
};

export function Header({ onSettings, onRefresh, onOpenPortal, portalUrl }: Props) {
  return (
    <header className={styles.header}>
      {portalUrl && (
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onOpenPortal}
          title={`Open SSO portal (${portalUrl})`}
        >
          ↗
        </button>
      )}
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onRefresh}
        title="Rescan open tabs"
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
