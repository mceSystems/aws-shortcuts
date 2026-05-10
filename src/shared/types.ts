export type Role = {
  name: string;
};

export type RegionObservation = {
  region: string;
  hits: number;
  lastSeenAt: number;
};

export type RoleObservation = {
  roleName: string;
  hits: number;
  lastSeenAt: number;
};

export type Account = {
  accountId: string;
  name: string;
  email?: string;
  appInstanceId: string;
  roles: Role[];
  /** Confirmed default role. Empty until single-role auto-set, user-confirmed, or manual pick. */
  defaultRoleName: string;
  /** Observed roles from console visits. Drives the role suggestion banner. */
  observedRoles?: RoleObservation[];
  /** Roles the user has actively declined for default-role suggestion. */
  dismissedRoles?: string[];
  /** Confirmed default region. Empty until user explicitly confirms or sets manually. */
  defaultRegion: string;
  /** Observed regions from console visits. Drives the region suggestion banner. */
  observedRegions?: RegionObservation[];
  /** Regions the user has actively declined for default-region suggestion. */
  dismissedRegions?: string[];
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
