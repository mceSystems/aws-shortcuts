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
  destinationUrl?: string;
};

export type Recent = {
  id: string;
  accountId: string;
  roleName: string;
  region: string;
  service: string;
  feature?: string;
  url: string;
  ts: number;
  hits: number;
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
  multiSessionVerified: boolean;
  catalogLastRefreshAt?: number;
};
