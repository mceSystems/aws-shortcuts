import { useEffect, useState } from 'react';
import { Onboarding } from './onboarding/Onboarding';
import { Main } from './main/Main';
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
    // Only cache once there's actual config to skip the onboarding flash on
    // subsequent opens. No ssoConfig = no point caching defaults.
    if (!boot.ssoConfig) {
      window.localStorage.removeItem(CACHE_KEY);
      return;
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(boot));
  } catch {
    // ignore
  }
}

function isReady(boot: Bootstrap | undefined): boolean {
  return Boolean(boot?.ssoConfig && boot?.multiSessionVerified && boot?.hasAccounts);
}

function entryStep(boot: Bootstrap | undefined): number {
  if (!boot?.multiSessionVerified) return 0;
  if (!boot?.ssoConfig) return 1;
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

  async function wipeAll() {
    try {
      await Promise.all([
        chrome.storage.sync.clear(),
        chrome.storage.local.clear(),
        chrome.storage.session.clear(),
      ]);
    } catch (e) {
      console.error('[aws-shortcut] storage wipe failed', e);
    }
    try {
      const existing = await chrome.declarativeNetRequest.getDynamicRules();
      if (existing.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existing.map((r) => r.id),
        });
      }
    } catch (e) {
      console.error('[aws-shortcut] dnr wipe failed', e);
    }
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
    // Hard reload popup so no in-memory React state survives + storage
    // listeners can't repopulate the cache mid-wipe.
    window.location.reload();
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
    <div className={styles.app}>
      <Main
        onOpenSettings={() => chrome.runtime.openOptionsPage()}
        onWipe={wipeAll}
      />
    </div>
  );
}
