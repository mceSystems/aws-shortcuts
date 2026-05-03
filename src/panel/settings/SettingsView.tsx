import { CatalogSection } from '@/options/CatalogSection';
import styles from './SettingsView.module.css';

type Props = {
  onBack: () => void;
};

export function SettingsView({ onBack }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back">
          ←
        </button>
        <h1 className={styles.title}>Settings</h1>
      </div>
      <div className={styles.body}>
        <CatalogSection />
      </div>
    </div>
  );
}
