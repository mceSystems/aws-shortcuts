import { useEffect, useMemo, useState } from 'react';
import { send } from '@/shared/messages';
import type { Account } from '@/shared/types';
import { pickRegionSuggestion } from '@/shared/regions';
import { pickRoleSuggestion } from '@/shared/roles';
import { chipColor } from '@/shared/colors';
import styles from './SuggestionQueue.module.css';

type Suggestion =
  | { kind: 'role'; account: Account; value: string; hits: number }
  | { kind: 'region'; account: Account; value: string; hits: number };

type Props = { accounts: Account[] };

export function SuggestionQueue({ accounts }: Props) {
  const suggestions = useMemo<Suggestion[]>(() => buildSuggestions(accounts), [accounts]);
  const [idx, setIdx] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (idx >= suggestions.length && suggestions.length > 0) {
      setIdx(suggestions.length - 1);
    }
  }, [suggestions.length, idx]);

  const current = suggestions[idx];

  useEffect(() => {
    if (!current || hidden) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setHidden(true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, hidden, suggestions.length]);

  if (hidden || !current) return null;

  const total = suggestions.length;
  const color = chipColor(current.account.color);
  const isRole = current.kind === 'role';
  const subject = isRole ? 'role' : 'region';

  async function accept() {
    if (current.kind === 'role') {
      await send({
        type: 'SET_ACCOUNT_DEFAULT_ROLE',
        accountId: current.account.accountId,
        roleName: current.value,
      });
    } else {
      await send({
        type: 'SET_ACCOUNT_DEFAULT_REGION',
        accountId: current.account.accountId,
        region: current.value,
      });
    }
  }

  async function pickAnother() {
    if (current.kind === 'role') {
      await send({
        type: 'DISMISS_ROLE_SUGGESTION',
        accountId: current.account.accountId,
        roleName: current.value,
      });
    } else {
      await send({
        type: 'DISMISS_REGION_SUGGESTION',
        accountId: current.account.accountId,
        region: current.value,
      });
    }
  }

  return (
    <div
      className={styles.banner}
      style={{ ['--banner-color' as string]: color }}
      role="region"
      aria-label="Suggestion"
    >
      <div className={styles.head}>
        <div className={styles.chip}>
          <span className={styles.dot} />
          <span className={styles.chipName}>{current.account.name}</span>
        </div>
        <div className={styles.nav}>
          {total > 1 && (
            <>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => setIdx((i) => Math.max(i - 1, 0))}
                disabled={idx === 0}
                aria-label="Previous suggestion"
              >
                ‹
              </button>
              <span className={styles.count}>
                {idx + 1}/{total}
              </span>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => setIdx((i) => Math.min(i + 1, total - 1))}
                disabled={idx === total - 1}
                aria-label="Next suggestion"
              >
                ›
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.close}
            onClick={() => setHidden(true)}
            aria-label="Dismiss all suggestions"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={styles.question}>
        Use <strong className={styles.value}>{current.value}</strong> as default {subject}?
      </div>

      <div className={styles.meta}>
        Seen {current.hits} {current.hits === 1 ? 'time' : 'times'}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={pickAnother}>
          Pick another
        </button>
        <button type="button" className={styles.primary} onClick={accept}>
          Yes, set
        </button>
      </div>
    </div>
  );
}

function buildSuggestions(accounts: Account[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const a of accounts) {
    if (!a.defaultRoleName) {
      const pick = pickRoleSuggestion(a.observedRoles, a.dismissedRoles);
      if (pick) out.push({ kind: 'role', account: a, value: pick.roleName, hits: pick.hits });
    }
    if (!a.defaultRegion) {
      const pick = pickRegionSuggestion(a.observedRegions, a.dismissedRegions);
      if (pick) out.push({ kind: 'region', account: a, value: pick.region, hits: pick.hits });
    }
  }
  return out.sort((a, b) => b.hits - a.hits);
}
