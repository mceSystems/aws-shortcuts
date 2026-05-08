import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { StepDots } from '../components/StepDots';
import { send } from '@/shared/messages';
import styles from './Onboarding.module.css';
import scan from './ScanStep.module.css';

type Phase = 'scanning' | 'needsPortal';

type Props = {
  stepIndex?: number;
  totalSteps?: number;
  onBack: () => void;
  onComplete: () => void;
};

export function ScanStep({
  stepIndex = 2,
  totalSteps = 3,
  onBack,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  // First scan miss auto-fires the bg-tab capture path. Subsequent misses
  // fall to the "Retry" button so the user can decide.
  const autoReloadedRef = useRef(false);

  useEffect(() => {
    void runScan();

    // Auto-retry scan when bearer lands in session storage.
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'session' && changes.bearerToken && changes.bearerToken.newValue) {
        void runScan();
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runScan() {
    setPhase('scanning');
    setError(null);
    setReloading(false);
    const res = await send({ type: 'SCAN_PORTAL' });
    if (res.ok) {
      onComplete();
      return;
    }
    // First miss: try the bg-tab capture path. SW opens a hidden portal tab,
    // waits for bearer, scans, closes the tab. Avoids touching the user's
    // active portal tab (which would steal focus + close the popup).
    if (!autoReloadedRef.current) {
      autoReloadedRef.current = true;
      setReloading(true);
      const bg = await send({ type: 'CAPTURE_AND_SCAN' });
      if (bg.ok) {
        onComplete();
        return;
      }
      setError(bg.error);
      setPhase('needsPortal');
      setReloading(false);
      return;
    }
    setError(res.error);
    setPhase('needsPortal');
  }

  async function retryViaBgTab() {
    setReloading(true);
    setError(null);
    setPhase('scanning');
    const bg = await send({ type: 'CAPTURE_AND_SCAN' });
    if (bg.ok) {
      onComplete();
      return;
    }
    setError(bg.error);
    setPhase('needsPortal');
    setReloading(false);
  }

  return (
    <div className={styles.scene}>
      <StepDots total={totalSteps} current={stepIndex} />
      <div className={styles.body}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Scanning your portal</h1>
          <p className={styles.lede}>
            {phase === 'scanning' && (reloading
              ? 'Loading portal in a background tab. We\'ll grab the auth token as soon as it lands.'
              : 'Reading accounts and roles from the portal API…')}
            {phase === 'needsPortal' &&
              'Couldn\'t grab a token. Make sure you\'re logged in to the portal, then retry.'}
          </p>
        </div>

        {phase === 'scanning' && (
          <div className={scan.spinnerRow}>
            <div className={scan.spinner} aria-hidden />
            <span>{reloading ? 'Waiting for portal…' : 'Talking to portal.sso…'}</span>
          </div>
        )}

        {phase === 'needsPortal' && error && (
          <div className={scan.errorBox}>{error}</div>
        )}
      </div>

      <div className={styles.actionsRow}>
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <span className={styles.spacer} />
        {phase === 'needsPortal' && (
          <Button onClick={retryViaBgTab} disabled={reloading}>
            {reloading ? 'Retrying…' : 'Retry ↻'}
          </Button>
        )}
      </div>
    </div>
  );
}

