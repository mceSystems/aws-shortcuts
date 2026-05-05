import { CatalogSection } from '@/options/CatalogSection';
import { PortalSection } from './PortalSection';
import { ResetSection } from './ResetSection';
import styles from './SettingsView.module.css';

type Props = {
  onBack: () => void;
  onChangePortal: () => void;
};

export function SettingsView({ onBack, onChangePortal }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back">
          ←
        </button>
        <h1 className={styles.title}>Settings</h1>
      </div>
      <div className={styles.body}>
        <PortalSection onChangePortal={onChangePortal} />
        <CatalogSection />
        <ResetSection />
      </div>
    </div>
  );
}
