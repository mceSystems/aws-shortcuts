import type { Account } from './types';

export type Msg =
  | { type: 'GET_BEARER' }
  | { type: 'SCAN_PORTAL' }
  | { type: 'ACCOUNT_COLOR_OBSERVED'; accountId: string; colorName: string }
  | { type: 'ACCOUNT_REGION_OBSERVED'; accountId: string; region: string }
  | { type: 'SET_ACCOUNT_DEFAULT_REGION'; accountId: string; region: string }
  | { type: 'DISMISS_REGION_SUGGESTION'; accountId: string; region: string }
  | { type: 'ACCOUNT_ROLE_OBSERVED'; accountId: string; roleName: string }
  | { type: 'SET_ACCOUNT_DEFAULT_ROLE'; accountId: string; roleName: string }
  | { type: 'DISMISS_ROLE_SUGGESTION'; accountId: string; roleName: string }
  | { type: 'RESCAN_OPEN_TABS' }
  | { type: 'CAPTURE_AND_SCAN_VIA_BG_TAB' }
  | { type: 'REORDER_ACCOUNTS'; visible: string[]; hidden: string[] };

/** Protocol for bg → content-script. Uses the same chrome.runtime channel. */
export type ContentScriptMsg = { type: 'RESCAN_TAB' };

export type MsgResponse =
  | { ok: true; bearer?: string; accounts?: Account[] }
  | { ok: false; error: string };

export function send(msg: Msg): Promise<MsgResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res: MsgResponse | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message ?? 'Runtime error' });
        return;
      }
      resolve(res ?? { ok: false, error: 'No response from background' });
    });
  });
}
