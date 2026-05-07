import { useEffect, useState } from 'react';
import { getSync, mutateSync } from '@/shared/storage';
import styles from '@/options/options.module.css';
import own from './AutoCloseSection.module.css';

export function AutoCloseSection() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void getSync().then((sync) => setEnabled(!!sync.prefs.autoCloseOnOpen));
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'sync' || !changes.prefs) return;
      const next = changes.prefs.newValue as { autoCloseOnOpen?: boolean } | undefined;
      setEnabled(!!next?.autoCloseOnOpen);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  function toggle(next: boolean): void {
    setEnabled(next);
    void mutateSync((sync) => ({
      prefs: { ...sync.prefs, autoCloseOnOpen: next },
    }));
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Close panel after opening a service</h2>
        <p className={styles.sectionHint}>
          Auto-closes the side panel after a successful launch. Off by default.
        </p>
      </div>
      <label className={own.toggleRow}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Close panel automatically after launch</span>
      </label>
    </section>
  );
}
