import { useEffect, useState } from 'react';
import { getSync, mutateSync } from '@/shared/storage';
import sectionStyles from '@/options/options.module.css';
import styles from './TabsGroupingSection.module.css';

export function TabsGroupingSection() {
  const [autoOn, setAutoOn] = useState(false);
  const [minTabs, setMinTabs] = useState(2);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getSync().then((sync) => {
      setAutoOn(sync.prefs.autoGroupByAccount === true);
      setMinTabs(Math.max(1, Math.min(10, sync.prefs.groupMinTabs ?? 2)));
      setLoaded(true);
    });
  }, []);

  async function toggleAuto() {
    const next = !autoOn;
    setAutoOn(next);
    await mutateSync((sync) => ({
      prefs: { ...sync.prefs, autoGroupByAccount: next },
    }));
  }

  async function changeMin(n: number) {
    const clamped = Math.max(1, Math.min(10, Math.trunc(n) || 2));
    setMinTabs(clamped);
    await mutateSync((sync) => ({
      prefs: { ...sync.prefs, groupMinTabs: clamped },
    }));
  }

  if (!loaded) return null;

  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionHead}>
        <h2 className={sectionStyles.sectionTitle}>Tab grouping</h2>
        <p className={sectionStyles.sectionHint}>
          Group AWS console tabs by account in Chrome's tab strip.
        </p>
      </div>

      <div className={styles.row}>
        <div className={styles.label}>
          <span className={styles.labelText}>Auto-group by account</span>
          <span className={styles.labelHint}>
            Automatically group when threshold is met.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoOn}
          aria-label="Auto-group AWS tabs by account"
          className={[styles.toggle, autoOn ? styles.toggleOn : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            void toggleAuto();
          }}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.label}>
          <span className={styles.labelText}>Minimum tabs per account</span>
          <span className={styles.labelHint}>
            Skip accounts with fewer tabs than this.
          </span>
        </div>
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          className={styles.numberInput}
          value={minTabs}
          disabled={!autoOn}
          onChange={(e) => {
            void changeMin(Number(e.target.value));
          }}
        />
      </div>

      <p className={styles.helpText}>
        Use the &ldquo;Group by account&rdquo; button in the Tabs panel to group
        manually anytime.
      </p>
    </section>
  );
}
