import { useEffect, useState } from 'react';
import { Onboarding } from './onboarding/Onboarding';
import { Main } from './main/Main';
import { SettingsView } from './settings/SettingsView';
import { getSync } from '@/shared/storage';
import styles from './App.module.css';

type Phase = 'onboarding' | 'ready' | 'settings' | 'add-identity-center';

const CACHE_KEY = 'aws-shortcut:bootstrap';

type Bootstrap = {
  identityCentersCount: number;
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
    // Only cache once there's an Identity Center configured, to skip the
    // onboarding flash on subsequent opens. No IdC = onboarding always.
    if (boot.identityCentersCount === 0) {
      window.localStorage.removeItem(CACHE_KEY);
      return;
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(boot));
  } catch {
    // ignore
  }
}

function isReady(boot: Bootstrap | undefined): boolean {
  return Boolean(
    boot && boot.identityCentersCount > 0 && boot.multiSessionVerified && boot.hasAccounts,
  );
}

function entryStep(boot: Bootstrap | undefined): number {
  if (!boot?.multiSessionVerified) return 0;
  if (!boot || boot.identityCentersCount === 0) return 1;
  if (!boot.hasAccounts) return 2;
  return 0;
}

export function App() {
  const cached = readCached();
  const [phase, setPhase] = useState<Phase>(isReady(cached) ? 'ready' : 'onboarding');
  const [boot, setBoot] = useState<Bootstrap | undefined>(cached);

  useEffect(() => {
    void hydrate();
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (
        area === 'sync' &&
        (changes.identityCenters || changes.prefs || changes.accounts)
      ) {
        void hydrate();
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  async function hydrate() {
    const sync = await getSync();
    const next: Bootstrap = {
      identityCentersCount: sync.identityCenters.length,
      multiSessionVerified: sync.prefs.multiSessionVerified,
      hasAccounts: sync.accounts.length > 0,
    };
    writeCached(next);
    setBoot(next);
    // Don't auto-bounce the user out of the settings flow / add-IdC flow
    // they explicitly navigated into. Storage updates (e.g. account
    // observations triggered by a harvest tab) shouldn't yank them back
    // to the main panel.
    setPhase((cur) => {
      if (cur === 'settings' || cur === 'add-identity-center') return cur;
      return isReady(next) ? 'ready' : 'onboarding';
    });
  }

  if (phase === 'onboarding') {
    return (
      <div className={styles.app}>
        <Onboarding
          startStep={entryStep(boot)}
          onComplete={() => setPhase('ready')}
        />
      </div>
    );
  }

  if (phase === 'settings') {
    return (
      <div className={styles.app}>
        <SettingsView
          onBack={() => setPhase('ready')}
          onAddIdentityCenter={() => setPhase('add-identity-center')}
        />
      </div>
    );
  }

  if (phase === 'add-identity-center') {
    return (
      <div className={styles.app}>
        <Onboarding
          skipMultiSession
          onComplete={() => setPhase('settings')}
          onCancel={() => setPhase('settings')}
        />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <Main onOpenSettings={() => setPhase('settings')} />
    </div>
  );
}
