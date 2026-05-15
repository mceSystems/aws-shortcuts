import { useEffect, useRef, useState } from 'react';
import { wipeAll } from '@/shared/wipe';
import styles from '@/options/options.module.css';
import own from './ResetSection.module.css';

const ITEMS = [
  'The connected portal URL and the scanned account list',
  'Saved favorites',
  'Recently-closed AWS console tabs',
  'Account, role, and region preferences',
  'Side-panel layout preferences',
  'Cached IAM Identity Center session and the multi-session subdomain map',
  'AWS console cookies (you will be signed out of the AWS console)',
];

export function ResetSection() {
  const [stage, setStage] = useState<'idle' | 'confirm' | 'wiping'>('idle');
  const confirmRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (stage === 'confirm') {
      confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [stage]);

  async function doWipe() {
    setStage('wiping');
    await wipeAll();
    // wipeAll triggers window.location.reload, so this component unmounts
    // before any further state update lands.
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Reset extension</h2>
        <p className={styles.sectionHint}>
          Returns the extension to a fresh-install state. You&apos;ll need to
          re-onboard afterwards.
        </p>
      </div>

      {stage === 'idle' && (
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setStage('confirm')}
          >
            Reset extension
          </button>
        </div>
      )}

      {(stage === 'confirm' || stage === 'wiping') && (
        <div ref={confirmRef} className={own.confirmBox}>
          <p className={own.confirmIntro}>
            This will permanently delete:
          </p>
          <ul className={own.list}>
            {ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={doWipe}
              disabled={stage === 'wiping'}
            >
              {stage === 'wiping' ? 'Resetting…' : 'Yes, delete everything'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setStage('idle')}
              disabled={stage === 'wiping'}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
