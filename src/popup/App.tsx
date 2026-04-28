import { useEffect, useState } from 'react';
import { Onboarding } from './onboarding/Onboarding';
import { getSync } from '@/shared/storage';
import type { SsoConfig } from '@/shared/types';
import styles from './App.module.css';

type Phase = 'onboarding' | 'ready';

const CACHE_KEY = 'aws-shortcut:bootstrap';

type Bootstrap = {
  ssoConfig?: SsoConfig;
  multiSessionVerified: boolean;
  hasAccounts: boolean;
};

function readCached(): Bootstrap | undefined {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Bootstrap) : undefined;
  } catch {
    return undefined;
  }
}

function writeCached(boot: Bootstrap): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(boot));
  } catch {
    // ignore
  }
}

function isReady(boot: Bootstrap | undefined): boolean {
  return Boolean(boot?.ssoConfig && boot?.multiSessionVerified && boot?.hasAccounts);
}

function entryStep(boot: Bootstrap | undefined): number {
  if (!boot?.ssoConfig) return 0;
  if (!boot?.multiSessionVerified) return 1;
  if (!boot?.hasAccounts) return 2;
  return 0;
}

export function App() {
  const cached = readCached();
  const [phase, setPhase] = useState<Phase>(isReady(cached) ? 'ready' : 'onboarding');
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | undefined>(cached?.ssoConfig);
  const [boot, setBoot] = useState<Bootstrap | undefined>(cached);

  useEffect(() => {
    void hydrate();
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'sync' && (changes.ssoConfig || changes.prefs || changes.accounts)) {
        void hydrate();
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  async function hydrate() {
    const sync = await getSync();
    const next: Bootstrap = {
      ssoConfig: sync.ssoConfig,
      multiSessionVerified: sync.prefs.multiSessionVerified,
      hasAccounts: sync.accounts.length > 0,
    };
    writeCached(next);
    setSsoConfig(next.ssoConfig);
    setBoot(next);
    setPhase(isReady(next) ? 'ready' : 'onboarding');
  }

  if (phase === 'onboarding') {
    return (
      <div className={styles.app}>
        <Onboarding
          initialSsoConfig={ssoConfig}
          startStep={entryStep(boot)}
          onComplete={() => setPhase('ready')}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.app} ${styles.placeholder}`}>
      AWS Shortcut · ready ({ssoConfig?.portalHost})
    </div>
  );
}
