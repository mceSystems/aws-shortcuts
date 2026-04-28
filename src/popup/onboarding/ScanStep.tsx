import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { StepDots } from '../components/StepDots';
import { send } from '@/shared/messages';
import { getSync } from '@/shared/storage';
import type { Account } from '@/shared/types';
import styles from './Onboarding.module.css';
import scan from './ScanStep.module.css';

type Phase = 'scanning' | 'success' | 'needsPortal';

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [portalTab, setPortalTab] = useState<PortalTabState | null>(null);
  const [reloading, setReloading] = useState(false);

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
  }, []);

  async function runScan() {
    setPhase('scanning');
    setError(null);
    setReloading(false);
    const res = await send({ type: 'SCAN_PORTAL' });
    if (res.ok) {
      setAccounts(res.accounts ?? []);
      setPhase('success');
      return;
    }
    setError(res.error);
    const tab = await findPortalTab();
    setPortalTab(tab);
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
          <h1 className={styles.title}>
            {phase === 'success' ? 'Found your accounts' : 'Scanning your portal'}
          </h1>
          <p className={styles.lede}>
            {phase === 'scanning' && (reloading
              ? 'Reloading portal so we can capture the auth token…'
              : 'Reading accounts and roles from the portal API…')}
            {phase === 'success' &&
              `${accounts.length} account${accounts.length === 1 ? '' : 's'} ready. You can change defaults in settings later.`}
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

        {phase === 'success' && (
          <ul className={scan.accountList}>
            {accounts.slice(0, 8).map((a) => (
              <li key={a.accountId} className={scan.accountRow}>
                <span className={scan.dot} style={{ background: a.color }} />
                <span className={scan.accountName}>{a.name}</span>
                <span className={scan.accountMeta}>
                  {a.roles.length} role{a.roles.length === 1 ? '' : 's'}
                </span>
              </li>
            ))}
            {accounts.length > 8 && (
              <li className={scan.accountMore}>+{accounts.length - 8} more</li>
            )}
          </ul>
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
        {phase === 'success' && <Button onClick={onComplete}>Done ▸</Button>}
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
