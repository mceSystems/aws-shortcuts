import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { StepDots } from '../components/StepDots';
import { TextInput } from '../components/TextInput';
import { setSync } from '@/shared/storage';
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
  onContinue: () => void;
};

export function ConnectStep({ initialUrl = '', onContinue }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pickedTabId, setPickedTabId] = useState<number | null>(null);

  useEffect(() => {
    void findOpenPortalTabs().then(setSuggestions);
  }, []);

  function pickSuggestion(s: Suggestion) {
    setUrl(s.startUrl);
    setPickedTabId(s.tabId ?? null);
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
    setBusy(true);
    setError(null);
    try {
      await setSync({
        ssoConfig: {
          startUrl: parsed.startUrl,
          portalHost: parsed.portalHost,
          region: 'us-east-1',
        },
      });
      if (pickedTabId !== null) {
        // Tab already open. Don't shift focus — keeps popup alive so the
        // user lands in step 2 of the wizard.
        try {
          await chrome.tabs.get(pickedTabId);
        } catch {
          // Tab vanished between picking and clicking. Open a new one
          // (will steal focus + close popup, but that's the lesser evil).
          await chrome.tabs.create({ url: parsed.startUrl });
        }
      } else {
        // New tab path. User needs to log in there → focus shift is expected.
        await chrome.tabs.create({ url: parsed.startUrl });
      }
      onContinue();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className={styles.scene}>
      <StepDots total={3} current={1} />
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

        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            <span className={styles.fieldLabel}>Pick from your open tabs</span>
            <ul className={styles.suggestList}>
              {suggestions.map((s) => (
                <li key={s.tabId ?? s.startUrl}>
                  <button
                    type="button"
                    className={styles.suggestRow}
                    onClick={() => pickSuggestion(s)}
                  >
                    <span className={styles.suggestIcon} aria-hidden>↳</span>
                    <span className={styles.suggestUrl}>{s.startUrl}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.actions}>
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
