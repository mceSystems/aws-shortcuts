import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { StepDots } from '../components/StepDots';
import { send } from '@/shared/messages';
import { getSync } from '@/shared/storage';
import styles from './Onboarding.module.css';
import scan from './ScanStep.module.css';

type Phase = 'scanning' | 'needsPortal';

type PortalTabState = {
  tabId: number | null;
  startUrl: string;
};

type Props = {
  onBack: () => void;
  onComplete: () => void;
};

export function ScanStep({ onBack, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [error, setError] = useState<string | null>(null);
  const [portalTab, setPortalTab] = useState<PortalTabState | null>(null);
  const [reloading, setReloading] = useState(false);
  // Auto-reload portal once on first scan miss; subsequent misses fall to
  // the manual "Reload portal" screen so the user isn't trapped in a loop.
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
    const tab = await findPortalTab();
    setPortalTab(tab);
    if (tab.tabId && !autoReloadedRef.current) {
      autoReloadedRef.current = true;
      setReloading(true);
      try {
        await chrome.tabs.reload(tab.tabId);
        // Stay in scanning phase; bearer arrival via storage.onChanged retries.
        return;
      } catch (e) {
        setError((e as Error).message);
        setReloading(false);
      }
    }
    setError(res.error);
    setPhase('needsPortal');
  }

  async function reloadPortal() {
    if (!portalTab?.tabId) return;
    setReloading(true);
    setError(null);
    try {
      await chrome.tabs.reload(portalTab.tabId);
      // Keep "scanning" feel while waiting for bearer to land via storage listener.
      setPhase('scanning');
    } catch (e) {
      setError((e as Error).message);
      setReloading(false);
    }
  }

  async function openPortal() {
    if (!portalTab?.startUrl) return;
    await chrome.tabs.create({ url: portalTab.startUrl });
    // Popup will close due to focus shift; nothing else to do here.
  }

  return (
    <div className={styles.scene}>
      <StepDots total={3} current={2} />
      <div className={styles.body}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Scanning your portal</h1>
          <p className={styles.lede}>
            {phase === 'scanning' && (reloading
              ? 'Reloading portal so we can capture the auth token…'
              : 'Reading accounts and roles from the portal API…')}
            {phase === 'needsPortal' && (portalTab?.tabId
              ? 'Your portal tab is open but we missed the auth token. Reload the page once and we\'ll grab it.'
              : 'We need to see the portal to capture an auth token. Open it once.')}
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
        {phase === 'needsPortal' && portalTab?.tabId && (
          <Button onClick={reloadPortal} disabled={reloading}>
            {reloading ? 'Reloading…' : 'Reload portal ↻'}
          </Button>
        )}
        {phase === 'needsPortal' && !portalTab?.tabId && portalTab?.startUrl && (
          <Button onClick={openPortal}>Open portal ↗</Button>
        )}
      </div>
    </div>
  );
}

async function findPortalTab(): Promise<PortalTabState> {
  const sync = await getSync();
  const startUrl = sync.ssoConfig?.startUrl ?? '';
  try {
    const tabs = await chrome.tabs.query({ url: ['https://*.awsapps.com/start*'] });
    const match = startUrl
      ? tabs.find((t) => t.url?.startsWith(sync.ssoConfig?.portalHost ?? '__none__')) ?? tabs[0]
      : tabs[0];
    return { tabId: match?.id ?? null, startUrl };
  } catch {
    return { tabId: null, startUrl };
  }
}
