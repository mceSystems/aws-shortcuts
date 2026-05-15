import { useEffect, useMemo, useState } from 'react';
import { send } from '@/shared/messages';
import { getSync } from '@/shared/storage';
import type { Account, IdentityCenter } from '@/shared/types';
import styles from '@/options/options.module.css';
import row from './IdentityCenters.module.css';

type ScanStatus =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; accountsAdded: number; rolesAdded: number };

type RemoveStatus = 'idle' | 'confirm';

type Props = {
  onAddIdentityCenter: () => void;
};

function countRoles(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + a.roles.length, 0);
}

export function IdentityCentersSection({ onAddIdentityCenter }: Props) {
  const [identityCenters, setIdentityCenters] = useState<IdentityCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [scanByIdc, setScanByIdc] = useState<Record<string, ScanStatus>>({});
  const [removeByIdc, setRemoveByIdc] = useState<Record<string, RemoveStatus>>({});
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    void hydrate();
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'sync') return;
      if (changes.identityCenters || changes.accounts) void hydrate();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  async function hydrate() {
    const sync = await getSync();
    setIdentityCenters(sync.identityCenters);
    setAccounts(sync.accounts);
  }

  const accountsByIdc = useMemo(() => {
    const m = new Map<string, Account[]>();
    for (const a of accounts) {
      const arr = m.get(a.identityCenterId) ?? [];
      arr.push(a);
      m.set(a.identityCenterId, arr);
    }
    return m;
  }, [accounts]);

  async function rescan(idcId: string) {
    setScanByIdc((s) => ({ ...s, [idcId]: { kind: 'scanning' } }));
    const before = accountsByIdc.get(idcId) ?? [];
    const accountsBefore = before.length;
    const rolesBefore = countRoles(before);

    const res = await send({ type: 'CAPTURE_AND_SCAN', identityCenterId: idcId });
    if (!res.ok) {
      setScanByIdc((s) => ({ ...s, [idcId]: { kind: 'error', message: res.error } }));
      return;
    }
    const after = await getSync();
    const afterList = after.accounts.filter((a) => a.identityCenterId === idcId);
    setScanByIdc((s) => ({
      ...s,
      [idcId]: {
        kind: 'ok',
        accountsAdded: Math.max(0, afterList.length - accountsBefore),
        rolesAdded: Math.max(0, countRoles(afterList) - rolesBefore),
      },
    }));
  }

  async function confirmRemove(idcId: string) {
    await send({ type: 'REMOVE_IDENTITY_CENTER', id: idcId });
    setRemoveByIdc((s) => {
      const next = { ...s };
      delete next[idcId];
      return next;
    });
  }

  async function commitRename(idcId: string) {
    const next = renameDraft[idcId];
    if (next === undefined) return;
    const trimmed = next.trim();
    const cur = identityCenters.find((i) => i.id === idcId);
    if (!cur || !trimmed || trimmed === cur.name) {
      setRenameDraft((s) => {
        const cp = { ...s };
        delete cp[idcId];
        return cp;
      });
      return;
    }
    await send({ type: 'RENAME_IDENTITY_CENTER', id: idcId, name: trimmed });
    setRenameDraft((s) => {
      const cp = { ...s };
      delete cp[idcId];
      return cp;
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Identity Centers</h2>
        <p className={styles.sectionHint}>
          Each portal you connect lets the extension read its accounts and roles. Same account
          across two portals shows up as two rows.
        </p>
      </div>

      <ul className={row.list}>
        {identityCenters.map((idc) => {
          const list = accountsByIdc.get(idc.id) ?? [];
          const status = scanByIdc[idc.id] ?? { kind: 'idle' };
          const removeStage = removeByIdc[idc.id] ?? 'idle';
          const draft = renameDraft[idc.id];
          return (
            <li key={idc.id} className={row.idc}>
              <div className={row.head}>
                <input
                  type="text"
                  className={row.nameInput}
                  value={draft ?? idc.name}
                  onChange={(e) =>
                    setRenameDraft((s) => ({ ...s, [idc.id]: e.target.value }))
                  }
                  onBlur={() => commitRename(idc.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    else if (e.key === 'Escape') {
                      setRenameDraft((s) => {
                        const cp = { ...s };
                        delete cp[idc.id];
                        return cp;
                      });
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  spellCheck={false}
                />
                <div className={row.headActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => rescan(idc.id)}
                    disabled={status.kind === 'scanning'}
                  >
                    {status.kind === 'scanning' ? 'Rescanning…' : 'Rescan'}
                  </button>
                  {removeStage === 'idle' ? (
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() =>
                        setRemoveByIdc((s) => ({ ...s, [idc.id]: 'confirm' }))
                      }
                    >
                      Remove
                    </button>
                  ) : (
                    <span className={row.confirmRow}>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => void confirmRemove(idc.id)}
                      >
                        Confirm remove {list.length} account{list.length === 1 ? '' : 's'}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() =>
                          setRemoveByIdc((s) => {
                            const cp = { ...s };
                            delete cp[idc.id];
                            return cp;
                          })
                        }
                      >
                        Cancel
                      </button>
                    </span>
                  )}
                </div>
              </div>
              <div className={row.urlLine} title={idc.startUrl}>
                {idc.startUrl}
              </div>
              <div className={row.statLine}>
                <span>{list.length} account{list.length === 1 ? '' : 's'}</span>
                <span aria-hidden> · </span>
                <span>
                  {countRoles(list)} role{countRoles(list) === 1 ? '' : 's'}
                </span>
                <span aria-hidden> · </span>
                <span className={row.region}>{idc.region}</span>
              </div>
              {status.kind === 'error' && (
                <p className={styles.errorMsg}>{status.message}</p>
              )}
              {status.kind === 'ok' && (
                <p className={styles.successMsg}>
                  {status.accountsAdded === 0 && status.rolesAdded === 0
                    ? 'Up to date.'
                    : `Added ${status.accountsAdded} accounts, ${status.rolesAdded} roles.`}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onAddIdentityCenter}
        >
          Add Identity Center
        </button>
      </div>
    </section>
  );
}

/** Backwards-compatible alias for callers wired to the old name. */
export const PortalSection = IdentityCentersSection;
