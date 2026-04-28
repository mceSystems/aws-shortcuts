export type Role = {
  name: string;
};

export type Account = {
  accountId: string;
  name: string;
  email?: string;
  appInstanceId: string;
  roles: Role[];
  defaultRoleName: string;
  defaultRegion: string;
  color: string;
};

export type Favorite = {
  id: string;
  accountId: string;
  roleName: string;
  region: string;
  service: string;
  feature?: string;
  label?: string;
  destinationUrl: string;
};

export type ServiceCatalogEntry = {
  id: string;
  name: string;
  consolePath: string;
  features?: { name: string; path: string }[];
};

export type SsoConfig = {
  startUrl: string;
  portalHost: string;
  region: string;
};

export type Prefs = {
  uiMode: 'popup' | 'sidepanel' | 'both';
  globalDefaultRegion: string;
  multiSessionVerified: boolean;
  catalogLastRefreshAt?: number;
};

export type SessionState = {
  sessionSubdomain: string;
  expiresAt?: number;
  tabIds: number[];
};

export type SyncSchema = {
  ssoConfig?: SsoConfig;
  accounts: Account[];
  favorites: Favorite[];
  prefs: Prefs;
};

export type LocalSchema = {
  serviceCatalog: ServiceCatalogEntry[];
};

export type SessionSchema = {
  bearerToken?: string;
  bearerCapturedAt?: number;
  sessions: Record<string, SessionState>;
};
