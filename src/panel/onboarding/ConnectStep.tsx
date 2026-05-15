import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { StepDots } from '../components/StepDots';
import { TextInput } from '../components/TextInput';
import { send } from '@/shared/messages';
import { getSync, identityCenterIdFromHost } from '@/shared/storage';
import type { IdentityCenter } from '@/shared/types';
import styles from './Onboarding.module.css';

const PLACEHOLDER = 'https://d-XXXXXXXXXX.awsapps.com/start/';

type Suggestion = {
  startUrl: string;
  portalHost: string;
  hostname: string;
  tabId?: number;
};

type Props = {
  initialUrl?: string;
  initialName?: string;
  stepIndex?: number;
  totalSteps?: number;
  onBack: () => void;
  onContinue: (identityCenterId: string) => void;
};

export function ConnectStep({
  initialUrl = '',
  initialName = '',
  stepIndex = 1,
  totalSteps = 3,
  onBack,
  onContinue,
}: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pickedTabId, setPickedTabId] = useState<number | null>(null);
  const [existingHosts, setExistingHosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    void getSync().then((sync) => {
      if (alive) setExistingHosts(new Set(sync.identityCenters.map((i) => i.portalHost)));
    });
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'sync' || !changes.identityCenters) return;
      const next = changes.identityCenters.newValue as IdentityCenter[] | undefined;
      setExistingHosts(new Set((next ?? []).map((i) => i.portalHost)));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void findOpenPortalTabs().then((found) => {
        if (alive) setSuggestions(found);
      });
    };
    refresh();

    const onUpdated = (
      _id: number,
      change: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (!tab.url?.includes('.awsapps.com')) return;
      if (change.url || change.status === 'complete') refresh();
    };
    const onRemoved = () => refresh();
    const onCreated = (tab: chrome.tabs.Tab) => {
      if (tab.url?.includes('.awsapps.com/start')) refresh();
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.onCreated.addListener(onCreated);
    return () => {
      alive = false;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      chrome.tabs.onCreated.removeListener(onCreated);
    };
  }, []);

  function pickSuggestion(s: Suggestion) {
    setUrl(s.startUrl);
    setPickedTabId(s.tabId ?? null);
    if (!name) setName(s.hostname);
    if (error) setError(null);
  }

  function onUrlChange(value: string) {
    setUrl(value);
    if (pickedTabId !== null) setPickedTabId(null);
    if (error) setError(null);
  }

  async function handleContinue() {
    const parsed = parsePortalUrl(url);
    if (!parsed) {
      setError('Enter your AWS access portal URL (e.g. https://d-xxxxxx.awsapps.com/start/).');
      return;
    }
    const idc: IdentityCenter = {
      id: identityCenterIdFromHost(parsed.portalHost),
      name: name.trim() || new URL(parsed.portalHost).hostname,
      startUrl: parsed.startUrl,
      portalHost: parsed.portalHost,
      region: 'us-east-1',
    };
    setBusy(true);
    setError(null);
    try {
      const res = await send({ type: 'ADD_IDENTITY_CENTER', idc });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      // Don't open the portal here. ScanStep's bg-tab capture flow is the
      // single owner of "open portal" — opening here too would race the SW's
      // findPortalTab (URL not yet committed on a fresh tab) and end up with
      // two tabs.
      onContinue(idc.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className={styles.scene}>
      <StepDots total={totalSteps} current={stepIndex} />
      <div className={styles.body}>
        <Logo size={44} />
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Connect your access portal</h1>
          <p className={styles.lede}>
            We&apos;ll read your accounts, roles, and default regions. Everything stays local in your browser.
          </p>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Portal URL</span>
          <TextInput
            type="url"
            inputMode="url"
            placeholder={PLACEHOLDER}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleContinue();
            }}
            autoFocus
            spellCheck={false}
          />
          {error ? (
            <span className={styles.fieldError}>{error}</span>
          ) : (
            <span className={styles.fieldHelp}>
              Find it in AWS console → IAM Identity Center → Settings → AWS access portal URL.
              {suggestions.length === 0 && ' If a portal tab is already open, you can pick it from here.'}
            </span>
          )}
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Display name</span>
          <TextInput
            type="text"
            placeholder="Optional — defaults to portal hostname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleContinue();
            }}
            spellCheck={false}
          />
        </label>

        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            <span className={styles.fieldLabel}>Pick from your open tabs</span>
            <ul className={styles.suggestList}>
              {suggestions.map((s) => {
                const alreadyAdded = existingHosts.has(s.portalHost);
                return (
                  <li key={s.tabId ?? s.startUrl}>
                    <button
                      type="button"
                      className={styles.suggestRow}
                      onClick={() => pickSuggestion(s)}
                      disabled={alreadyAdded}
                      title={
                        alreadyAdded
                          ? 'Already added — find it in Settings → Identity Centers.'
                          : undefined
                      }
                    >
                      <span className={styles.suggestIcon} aria-hidden>↳</span>
                      <span className={styles.suggestUrl}>{s.startUrl}</span>
                      {alreadyAdded && (
                        <span className={styles.suggestBadge}>already added</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.actionsRow}>
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <span className={styles.spacer} />
        <Button onClick={handleContinue} disabled={busy || url.trim().length === 0}>
          {busy
            ? pickedTabId !== null
              ? 'Scanning…'
              : 'Opening…'
            : pickedTabId !== null
              ? 'Scan ▸'
              : 'Open & scan ▸'}
        </Button>
      </div>
    </div>
  );
}

function parsePortalUrl(raw: string): { startUrl: string; portalHost: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!url.hostname.endsWith('.awsapps.com')) return null;
  const portalHost = `${url.protocol}//${url.hostname}`;
  const startUrl = `${portalHost}/start/`;
  return { startUrl, portalHost };
}

async function findOpenPortalTabs(): Promise<Suggestion[]> {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://*.awsapps.com/start*'] });
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const tab of tabs) {
      if (!tab.url) continue;
      const parsed = parsePortalUrl(tab.url);
      if (!parsed) continue;
      if (seen.has(parsed.portalHost)) continue;
      seen.add(parsed.portalHost);
      out.push({
        startUrl: parsed.startUrl,
        portalHost: parsed.portalHost,
        hostname: new URL(parsed.portalHost).hostname,
        tabId: tab.id,
      });
    }
    return out;
  } catch {
    return [];
  }
}
