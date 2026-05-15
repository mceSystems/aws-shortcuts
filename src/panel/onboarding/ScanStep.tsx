import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { StepDots } from '../components/StepDots';
import { send } from '@/shared/messages';
import styles from './Onboarding.module.css';
import scan from './ScanStep.module.css';

type Phase = 'scanning' | 'needsPortal';

type Props = {
  identityCenterId: string;
  stepIndex?: number;
  totalSteps?: number;
  onBack: () => void;
  onComplete: () => void;
};

export function ScanStep({
  identityCenterId,
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
  // bearerTick storage events can spawn concurrent runScans while one is
  // already in flight. The first to resolve fires onComplete → unmounts us,
  // but the others' awaits keep running and would call a stale onComplete
  // (= setPhase('ready') in App) after the user has navigated to Settings,
  // bouncing them back to Main. Guard every post-await side effect.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void runScan();

    // Auto-retry scan when a new bearer lands in session storage.
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'session' && (changes.bearers || changes.bearerTick)) {
        void runScan();
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      mountedRef.current = false;
      chrome.storage.onChanged.removeListener(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityCenterId]);

  async function runScan() {
    setPhase('scanning');
    setError(null);
    setReloading(false);
    const res = await send({ type: 'SCAN_PORTAL', identityCenterId });
    if (!mountedRef.current) return;
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
      const bg = await send({ type: 'CAPTURE_AND_SCAN', identityCenterId });
      if (!mountedRef.current) return;
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
    const bg = await send({ type: 'CAPTURE_AND_SCAN', identityCenterId });
    if (!mountedRef.current) return;
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

