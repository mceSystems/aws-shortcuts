import { CatalogSection } from '@/options/CatalogSection';
import { AutoCloseSection } from './AutoCloseSection';
import { IdentityCentersSection } from './PortalSection';
import { ResetSection } from './ResetSection';
import styles from './SettingsView.module.css';

type Props = {
  onBack: () => void;
  onAddIdentityCenter: () => void;
};

export function SettingsView({ onBack, onAddIdentityCenter }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back">
          ←
        </button>
        <h1 className={styles.title}>Settings</h1>
      </div>
      <div className={styles.body}>
        <IdentityCentersSection onAddIdentityCenter={onAddIdentityCenter} />
        <AutoCloseSection />
        <CatalogSection />
        <ResetSection />
      </div>
    </div>
  );
}
