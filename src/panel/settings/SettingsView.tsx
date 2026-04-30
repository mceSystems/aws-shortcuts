import { CatalogSection } from '@/options/CatalogSection';
import { HarvestSection } from '@/options/HarvestSection';
import styles from './SettingsView.module.css';

const isDev = import.meta.env.DEV;

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
        {isDev && <HarvestSection />}
      </div>
    </div>
  );
}
