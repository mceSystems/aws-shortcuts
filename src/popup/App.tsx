import { useEffect, useState } from 'react';
import { Onboarding } from './onboarding/Onboarding';
import { getSsoConfig } from '@/shared/storage';
import type { SsoConfig } from '@/shared/types';
import styles from './App.module.css';

type Phase = 'onboarding' | 'ready';

const CACHE_KEY = 'aws-shortcut:ssoConfig';

function readCached(): SsoConfig | undefined {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SsoConfig) : undefined;
  } catch {
    return undefined;
  }
}

function writeCached(cfg: SsoConfig | undefined): void {
  try {
    if (cfg) window.localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function App() {
  // Hydrate initial state synchronously from localStorage so returning users
  // skip the onboarding flash. chrome.storage.sync revalidates async.
  const cached = readCached();
  const [phase, setPhase] = useState<Phase>(cached ? 'ready' : 'onboarding');
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | undefined>(cached);

  useEffect(() => {
    void hydrate();
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'sync' && changes.ssoConfig) void hydrate();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  async function hydrate() {
    const cfg = await getSsoConfig();
    writeCached(cfg);
    setSsoConfig(cfg);
    setPhase(cfg ? 'ready' : 'onboarding');
  }

  if (phase === 'onboarding') {
    return (
      <div className={styles.app}>
        <Onboarding initialSsoConfig={ssoConfig} onComplete={() => setPhase('ready')} />
      </div>
    );
  }

  return (
    <div className={`${styles.app} ${styles.placeholder}`}>
      AWS Shortcut · ready ({ssoConfig?.portalHost})
    </div>
  );
}
