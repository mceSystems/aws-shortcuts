import { useEffect, useState } from 'react';
import { getSync, setSync } from '@/shared/storage';
import { send } from '@/shared/messages';
import type { Account, Prefs } from '@/shared/types';
import { AWS_REGIONS } from '@/popup/regions';

export function Settings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const sync = await getSync();
    setAccounts(sync.accounts);
    setPrefs(sync.prefs);
  }

  async function updatePrefs(patch: Partial<Prefs>) {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await setSync({ prefs: next });
  }

  async function updateAccount(id: string, patch: Partial<Account>) {
    const next = accounts.map((a) => (a.accountId === id ? { ...a, ...patch } : a));
    setAccounts(next);
    await setSync({ accounts: next });
  }

  async function rescan() {
    setScanning(true);
    setMessage('');
    try {
      await send({ type: 'PORTAL_SCAN_REQUEST' });
      await load();
      setMessage('Scan complete.');
    } catch (e) {
      setMessage(`Scan failed: ${(e as Error).message}`);
    } finally {
      setScanning(false);
    }
  }

  if (!prefs) return <div className="settings">Loading…</div>;

  return (
    <div className="settings">
      <h1>AWS Shortcut · Settings</h1>

      <section>
        <h2>Interface</h2>
        <label>
          UI surface:{' '}
          <select
            value={prefs.uiMode}
            onChange={(e) => updatePrefs({ uiMode: e.target.value as Prefs['uiMode'] })}
          >
            <option value="popup">Popup</option>
            <option value="sidepanel">Side panel</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label>
          Global default region:{' '}
          <select
            value={prefs.globalDefaultRegion}
            onChange={(e) => updatePrefs({ globalDefaultRegion: e.target.value })}
          >
            {AWS_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2>Accounts ({accounts.length})</h2>
        <button onClick={rescan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Re-scan portal'}
        </button>
        {message && <div className="settings__message">{message}</div>}
        <table className="settings__table">
          <thead>
            <tr>
              <th>Color</th>
              <th>Name</th>
              <th>Account ID</th>
              <th>Default role</th>
              <th>Default region</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.accountId}>
                <td>
                  <span className="settings__swatch" style={{ background: a.color }} />
                </td>
                <td>{a.name}</td>
                <td>{a.accountId}</td>
                <td>
                  <select
                    value={a.defaultRoleName}
                    onChange={(e) => updateAccount(a.accountId, { defaultRoleName: e.target.value })}
                  >
                    {a.roles.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={a.defaultRegion}
                    onChange={(e) => updateAccount(a.accountId, { defaultRegion: e.target.value })}
                  >
                    {AWS_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Multi-session</h2>
        <p>
          Verified:{' '}
          <strong>{prefs.multiSessionVerified ? 'Yes' : 'Not yet'}</strong>
        </p>
        <p>
          To enable in Chrome: open{' '}
          <a href="https://console.aws.amazon.com/" target="_blank" rel="noreferrer">
            console.aws.amazon.com
          </a>{' '}
          → top-right account menu → "Turn on multi-session".
        </p>
        <button onClick={() => updatePrefs({ multiSessionVerified: true })}>
          Mark as verified
        </button>
      </section>
    </div>
  );
}
