import type { Account, Favorite } from './types';

export type Msg =
  | { type: 'PORTAL_BEARER_CAPTURED'; token: string; portalHost: string }
  | { type: 'PORTAL_SCAN_REQUEST' }
  | { type: 'PORTAL_SCAN_RESULT'; accounts: Account[] }
  | { type: 'OPEN_TARGET'; favorite: Favorite }
  | { type: 'OPEN_COMPOSED'; accountIds: string[]; service: string; feature?: string; regionOverride?: string; roleOverride?: string }
  | { type: 'CONSOLE_FAVORITES_SCRAPED'; accountId: string; services: string[] }
  | { type: 'CONSOLE_SUBDOMAIN_OBSERVED'; accountId: string; roleName: string; sessionSubdomain: string; tabId: number };

export type MsgResponse =
  | { ok: true; [k: string]: unknown }
  | { ok: false; error: string };

export function send<R = MsgResponse>(msg: Msg): Promise<R> {
  return chrome.runtime.sendMessage(msg) as Promise<R>;
}
