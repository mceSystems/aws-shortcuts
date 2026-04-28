import type { Account } from './types';

export type Msg =
  | { type: 'GET_BEARER' }
  | { type: 'SCAN_PORTAL' };

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
