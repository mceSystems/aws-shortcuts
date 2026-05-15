import type { Account, Favorite, IdentityCenter } from './types';

export type Msg =
  | { type: 'GET_BEARER'; portalApiOrigin?: string }
  | { type: 'SCAN_PORTAL'; identityCenterId: string }
  | { type: 'SCAN_ALL' }
  | { type: 'ACCOUNT_COLOR_OBSERVED'; accountId: string; colorName: string }
  | { type: 'ACCOUNT_REGION_OBSERVED'; accountId: string; region: string }
  | { type: 'SET_ACCOUNT_PREFERRED_REGION'; identityCenterId: string; accountId: string; region: string }
  | { type: 'TOGGLE_REGION_LOCK'; identityCenterId: string; accountId: string; locked: boolean }
  | { type: 'ACCOUNT_ROLE_OBSERVED'; accountId: string; roleName: string }
  | { type: 'SET_ACCOUNT_PREFERRED_ROLE'; identityCenterId: string; accountId: string; roleName: string }
  | { type: 'TOGGLE_ROLE_LOCK'; identityCenterId: string; accountId: string; locked: boolean }
  | { type: 'RESCAN_OPEN_TABS' }
  | { type: 'CAPTURE_AND_SCAN'; identityCenterId: string }
  | { type: 'REORDER_ACCOUNTS'; visible: string[]; hidden: string[] }
  | { type: 'SET_ACCOUNT_ALIAS'; identityCenterId: string; accountId: string; alias: string }
  | { type: 'ADD_IDENTITY_CENTER'; idc: IdentityCenter }
  | { type: 'REMOVE_IDENTITY_CENTER'; id: string }
  | { type: 'RENAME_IDENTITY_CENTER'; id: string; name: string }
  | {
      type: 'SESSION_OBSERVED';
      accountId: string;
      sessionSubdomain: string;
      region: string;
      roleName: string;
    }
  | {
      type: 'RESOLVE_LAUNCH_URL';
      identityCenterId: string;
      accountId: string;
      roleName: string;
      region: string;
      consolePath: string;
      /** Service id from catalog (e.g. "ec2") — bumps openCounts. */
      serviceId?: string;
      /** Feature path if a deep link, omitted for service home. */
      featurePath?: string;
    }
  | { type: 'REFRESH_CATALOG' }
  | { type: 'CLEAR_RECENTS' }
  | { type: 'SAVE_FAVORITE'; fav: Favorite }
  | {
      type: 'UPDATE_FAVORITE';
      id: string;
      patch: Partial<Pick<Favorite, 'label' | 'accountId' | 'roleName' | 'region' | 'consolePath'>>;
    }
  | { type: 'DELETE_FAVORITE'; id: string }
  | { type: 'REORDER_FAVORITES'; ids: string[] }
  | { type: 'CLOSE_TAB'; tabId: number }
  | { type: 'RECONCILE_OPEN_TABS' };

/** Protocol for bg → content-script. Uses the same chrome.runtime channel. */
export type ContentScriptMsg = { type: 'RESCAN_TAB' };

export type MsgResponse =
  | {
      ok: true;
      bearer?: string;
      accounts?: Account[];
      url?: string;
      mode?: 'direct' | 'portal';
      catalog?: {
        updated: boolean;
        version: string;
        services: number;
        features: number;
        icons: number;
        fetchedAt: number;
        source: string;
      };
    }
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
