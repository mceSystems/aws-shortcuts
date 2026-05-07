import { getSync } from './storage';

/** Closes the current side-panel window if `prefs.autoCloseOnOpen` is on.
 *  Called from every launch site after a successful tab open or refocus. */
export async function closePanelIfPrefSet(): Promise<void> {
  try {
    const sync = await getSync();
    if (!sync.prefs.autoCloseOnOpen) return;
    window.close();
  } catch {
    // Pref read failed or window.close() unsupported in this context — no-op.
  }
}
