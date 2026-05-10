import { useState } from 'react';
import { Button } from '../components/Button';
import { StepDots } from '../components/StepDots';
import { getSync, setSync } from '@/shared/storage';
import styles from './Onboarding.module.css';
import illust from './MultiSessionIllust.module.css';

const CONSOLE_URL = 'https://console.aws.amazon.com/';

type Props = {
  onBack: () => void;
  onContinue: () => void;
};

export function MultiSessionStep({ onBack, onContinue }: Props) {
  const [busy, setBusy] = useState(false);

  async function openConsole() {
    await chrome.tabs.create({ url: CONSOLE_URL });
  }

  async function confirm() {
    setBusy(true);
    try {
      const sync = await getSync();
      await setSync({
        prefs: { ...sync.prefs, multiSessionVerified: true },
      });
      onContinue();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.scene}>
      <StepDots total={3} current={1} />
      <div className={styles.body}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Enable multi-session</h1>
          <p className={styles.lede}>
            AWS lets you keep up to 5 accounts open in the same browser at once.
            AWS Shortcut relies on this so switching accounts won&apos;t sign you out
            of the others.
          </p>
        </div>

        <MenuIllustration />

        <ol className={styles.checklist}>
          <li>
            <span className={styles.checklistNum}>1</span>
            Open <strong>console.aws.amazon.com</strong>.
          </li>
          <li>
            <span className={styles.checklistNum}>2</span>
            Top-right header → click <strong>Multi-session</strong>.
          </li>
          <li>
            <span className={styles.checklistNum}>3</span>
            Choose <strong>Turn on multi-session</strong>.
          </li>
        </ol>
      </div>

      <div className={styles.actionsRow}>
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={openConsole}>
          Open console ↗
        </Button>
        <Button onClick={confirm} disabled={busy}>
          {busy ? 'Saving…' : 'I enabled it ▸'}
        </Button>
      </div>
    </div>
  );
}

function MenuIllustration() {
  return (
    <div className={illust.wrap} aria-hidden>
      <div className={illust.bar}>
        <span className={illust.dot} />
        <span className={illust.dot} />
        <span className={illust.dot} />
        <span className={illust.barTitle}>console.aws.amazon.com</span>
      </div>
      <div className={illust.console}>
        <div className={illust.consoleBar}>
          <span className={illust.aws}>aws</span>
          <span className={illust.spacer} />
          <span className={illust.headerLink}>Provide feedback</span>
          <span className={illust.headerLinkPulse}>Multi-session ▾</span>
          <span className={illust.headerLink}>EN ▾</span>
        </div>
        <div className={illust.consoleBody} />
      </div>
    </div>
  );
}
