import { useEffect, useState } from 'react';
import { Onboarding } from './onboarding/Onboarding';
import { getSync } from '@/shared/storage';
import type { Prefs, SsoConfig } from '@/shared/types';
import styles from './App.module.css';

type Phase = 'onboarding' | 'ready';

const CACHE_KEY = 'aws-shortcut:bootstrap';

type Bootstrap = {
  ssoConfig?: SsoConfig;
  multiSessionVerified: boolean;
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
  return Boolean(boot?.ssoConfig && boot?.multiSessionVerified);
}

function entryStep(boot: Bootstrap | undefined): number {
  if (!boot?.ssoConfig) return 0;
  if (!boot?.multiSessionVerified) return 1;
  return 0;
}

export function App() {
  const cached = readCached();
  const [phase, setPhase] = useState<Phase>(isReady(cached) ? 'ready' : 'onboarding');
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | undefined>(cached?.ssoConfig);
  const [prefs, setPrefs] = useState<Pick<Prefs, 'multiSessionVerified'>>({
    multiSessionVerified: cached?.multiSessionVerified ?? false,
  });

  useEffect(() => {
    void hydrate();
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'sync' && (changes.ssoConfig || changes.prefs)) void hydrate();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  async function hydrate() {
    const sync = await getSync();
    const boot: Bootstrap = {
      ssoConfig: sync.ssoConfig,
      multiSessionVerified: sync.prefs.multiSessionVerified,
    };
    writeCached(boot);
    setSsoConfig(boot.ssoConfig);
    setPrefs({ multiSessionVerified: boot.multiSessionVerified });
    setPhase(isReady(boot) ? 'ready' : 'onboarding');
  }

  if (phase === 'onboarding') {
    return (
      <div className={styles.app}>
        <Onboarding
          initialSsoConfig={ssoConfig}
          startStep={entryStep({ ssoConfig, multiSessionVerified: prefs.multiSessionVerified })}
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
