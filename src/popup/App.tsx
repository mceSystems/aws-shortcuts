import { useEffect, useState } from 'react';
import { Composer } from './Composer';
import { Favorites } from './Favorites';
import { Palette } from './Palette';
import { useStore } from './store';
import { send } from '@/shared/messages';
import './App.css';

export function App() {
  const load = useStore((s) => s.load);
  const accounts = useStore((s) => s.accounts);
  const loaded = useStore((s) => s.loaded);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    const handler = (_changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' || area === 'local') void load();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function rescan() {
    setScanning(true);
    setScanError(null);
    try {
      const res = await send({ type: 'PORTAL_SCAN_REQUEST' });
      if (!res.ok) setScanError(res.error);
    } catch (e) {
      setScanError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  if (!loaded) return <div className="app app--loading">Loading...</div>;

  if (accounts.length === 0) {
    return (
      <div className="app app--empty">
        <h2>Welcome to AWS Shortcut</h2>
        <p>
          1. Open your AWS access portal.<br />
          2. Reload the portal page once after installing this extension (so we can capture the auth token).<br />
          3. Click <strong>Scan</strong>.
        </p>
        <div className="app__cta-row">
          <button
            onClick={() => {
              void chrome.tabs.create({ url: 'https://d-90679c71d5.awsapps.com/start/' });
            }}
          >
            Open portal
          </button>
          <button onClick={rescan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan'}
          </button>
        </div>
        {scanError && <div className="app__error">⚠ {scanError}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__title">AWS Shortcut</span>
        <div className="app__actions">
          <button title="Open palette (Cmd+K)" onClick={() => setPaletteOpen(true)}>
            ⌘K
          </button>
          <button title="Refresh accounts/roles" onClick={rescan} disabled={scanning}>
            {scanning ? '…' : '🔄'}
          </button>
          <button
            title="Settings"
            onClick={() => {
              void chrome.runtime.openOptionsPage();
            }}
          >
            ⚙
          </button>
        </div>
      </header>

      {scanError && <div className="app__error">⚠ {scanError}</div>}
      <Composer />
      <Favorites />

      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
