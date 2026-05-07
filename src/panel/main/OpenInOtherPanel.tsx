import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account } from '@/shared/types';
import { chipColor } from '@/shared/colors';
import { send } from '@/shared/messages';
import { closePanelIfPrefSet } from '@/shared/closePanel';
import { openOrFocusTab } from '@/shared/tabs';
import { AWS_REGIONS } from '@/shared/regions';
import styles from './OpenInOtherPanel.module.css';

type Props = {
  accounts: Account[];
  initialAccountId: string;
  initialRoleName: string;
  initialRegion: string;
  serviceId: string;
  featurePath?: string;
  consolePath: string;
  onClose: () => void;
};

type PickerKind = 'account' | 'role' | 'region' | null;

export function OpenInOtherPanel(props: Props) {
  const [accountId, setAccountId] = useState(props.initialAccountId);
  const [roleName, setRoleName] = useState(props.initialRoleName);
  const [region, setRegion] = useState(props.initialRegion);
  const [activePicker, setActivePicker] = useState<PickerKind>(null);
  const [accFilter, setAccFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const account = useMemo(
    () => props.accounts.find((a) => a.accountId === accountId) ?? null,
    [props.accounts, accountId],
  );

  // When account switches, snap role/region defaults to that account's prefs.
  useEffect(() => {
    if (!account) return;
    if (!account.roles.some((r) => r.name === roleName)) {
      setRoleName(account.preferredRoleName || account.roles[0]?.name || '');
    }
    const observed = account.observedRegions ?? [];
    if (region && !observed.some((r) => r.region === region) && account.preferredRegion !== region) {
      setRegion(account.preferredRegion || observed[0]?.region || region);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // Close on click-outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      props.onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [props.onClose]);

  const accountLabel = account?.alias || account?.name || accountId;

  const filteredAccounts = useMemo(() => {
    const q = accFilter.trim().toLowerCase();
    if (!q) return props.accounts;
    return props.accounts.filter((a) => {
      const hay = `${a.alias ?? ''} ${a.name} ${a.accountId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [props.accounts, accFilter]);

  async function commit() {
    if (!accountId || !roleName || !region) return;
    const res = await send({
      type: 'RESOLVE_LAUNCH_URL',
      accountId,
      roleName,
      region,
      consolePath: props.consolePath,
      serviceId: props.serviceId,
      featurePath: props.featurePath,
    });
    if (res.ok && res.url) {
      await openOrFocusTab(res.url);
      void closePanelIfPrefSet();
    } else {
      console.warn('[aws-shortcut/panel] open-in-other failed', res);
    }
    props.onClose();
  }

  return (
    <div
      ref={rootRef}
      className={styles.panel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (activePicker) setActivePicker(null);
          else props.onClose();
        } else if (e.key === 'Enter' && !activePicker) {
          e.preventDefault();
          void commit();
        }
      }}
    >
      <div className={styles.row}>
        <ChipButton
          color={chipColor(account?.color)}
          active={activePicker === 'account'}
          onClick={() => setActivePicker((p) => (p === 'account' ? null : 'account'))}
        >
          {accountLabel}
        </ChipButton>
        <ChipButton
          active={activePicker === 'role'}
          onClick={() => setActivePicker((p) => (p === 'role' ? null : 'role'))}
        >
          {roleName || 'role'}
        </ChipButton>
        <ChipButton
          active={activePicker === 'region'}
          onClick={() => setActivePicker((p) => (p === 'region' ? null : 'region'))}
        >
          {region || 'region'}
        </ChipButton>
        <span className={styles.spacer} />
        <button type="button" className={styles.cancelBtn} onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.openBtn}
          onClick={() => void commit()}
          disabled={!accountId || !roleName || !region}
        >
          Open
        </button>
      </div>

      {activePicker === 'account' && (
        <div className={styles.dropdown}>
          <input
            className={styles.filterInput}
            placeholder="Filter accounts…"
            value={accFilter}
            onChange={(e) => setAccFilter(e.target.value)}
            autoFocus
            spellCheck={false}
          />
          <ul className={styles.options}>
            {filteredAccounts.map((a) => (
              <li
                key={a.accountId}
                className={[
                  styles.option,
                  a.accountId === accountId ? styles.optionActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ ['--row-color' as string]: chipColor(a.color) }}
                onClick={() => {
                  setAccountId(a.accountId);
                  setActivePicker(null);
                  setAccFilter('');
                }}
              >
                <span className={styles.optionStripe} />
                <span className={styles.optionLabel}>{a.alias || a.name}</span>
                <span className={styles.optionMuted}>{a.accountId}</span>
              </li>
            ))}
            {filteredAccounts.length === 0 && (
              <li className={styles.optionEmpty}>No matches.</li>
            )}
          </ul>
        </div>
      )}

      {activePicker === 'role' && account && (
        <div className={styles.dropdown}>
          <ul className={styles.options}>
            {account.roles.length === 0 && (
              <li className={styles.optionEmpty}>No roles on this account.</li>
            )}
            {account.roles.map((r) => (
              <li
                key={r.name}
                className={[
                  styles.option,
                  r.name === roleName ? styles.optionActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setRoleName(r.name);
                  setActivePicker(null);
                }}
              >
                <span className={styles.optionLabel}>{r.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activePicker === 'region' && account && (
        <div className={styles.dropdown}>
          <input
            className={styles.filterInput}
            placeholder="Filter regions…"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            autoFocus
            spellCheck={false}
          />
          <ul className={styles.options}>
            {regionOptionsFiltered(account, region, regionFilter).map(({ region: r, observed, preferred }) => (
              <li
                key={r}
                className={[
                  styles.option,
                  r === region ? styles.optionActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setRegion(r);
                  setActivePicker(null);
                  setRegionFilter('');
                }}
              >
                <span className={styles.optionLabel}>{r}</span>
                {preferred && <span className={styles.optionTagAccent}>preferred</span>}
                {!preferred && observed && <span className={styles.optionTag}>observed</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type RegionOption = { region: string; observed: boolean; preferred: boolean };

function regionOptionsFiltered(
  account: Account,
  current: string,
  filter: string,
): RegionOption[] {
  const observed = new Set((account.observedRegions ?? []).map((o) => o.region));
  const q = filter.trim().toLowerCase();
  const known: readonly string[] = AWS_REGIONS;
  const hits = new Map((account.observedRegions ?? []).map((o) => [o.region, o.hits]));
  const base: RegionOption[] = known
    .filter((r) => (q ? r.toLowerCase().includes(q) : true))
    .map((r) => ({
      region: r,
      observed: observed.has(r),
      preferred: account.preferredRegion === r,
    }))
    .sort((a, b) => {
      if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
      const ah = hits.get(a.region) ?? 0;
      const bh = hits.get(b.region) ?? 0;
      if (ah !== bh) return bh - ah;
      return a.region.localeCompare(b.region);
    });
  if (
    current &&
    !known.includes(current) &&
    (q ? current.toLowerCase().includes(q) : true)
  ) {
    base.push({ region: current, observed: false, preferred: false });
  }
  return base;
}

function ChipButton({
  children,
  color,
  active,
  onClick,
}: {
  children: React.ReactNode;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[styles.chip, active ? styles.chipActive : ''].filter(Boolean).join(' ')}
      style={color ? ({ ['--row-color' as string]: color } as React.CSSProperties) : undefined}
      onClick={onClick}
    >
      {color !== undefined && <span className={styles.chipDot} />}
      <span className={styles.chipLabel}>{children}</span>
      <span className={styles.chipCaret}>▾</span>
    </button>
  );
}
