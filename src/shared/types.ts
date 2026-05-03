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
  /** User-set display alias. Falls back to `name` in UI. */
  alias?: string;
  email?: string;
  appInstanceId: string;
  roles: Role[];
  /** Preferred role for opens. Auto-updates with last-used unless `roleLocked`. */
  preferredRoleName: string;
  /** When true, opens never overwrite preferredRoleName. User-controlled pin. */
  roleLocked?: boolean;
  /** Observed roles from console visits. Drives picker ordering. */
  observedRoles?: RoleObservation[];
  /** Preferred region for opens. Auto-updates with last-used unless `regionLocked`. */
  preferredRegion: string;
  /** When true, opens never overwrite preferredRegion. User-controlled pin. */
  regionLocked?: boolean;
  /** Observed regions from console visits. Drives picker ordering. */
  observedRegions?: RegionObservation[];
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

export type ServiceFeature = { name: string; path: string };

export type ServiceCatalogEntry = {
  id: string;
  name: string;
  consolePath: string;
  /** Curated "popular" flag. Bumps service in empty-query default order +
   * small score bonus for fuzzy matches. */
  popular?: boolean;
  /** Service is region-pinned (IAM, Route53, CloudFront, …). Launcher pins
   * to us-east-1 regardless of account preferred region. Sourced from
   * botocore endpoints.json `isRegionalized: false`. */
  global?: boolean;
  /** Full names + synonyms used for search (e.g. "Simple Email Service" for ses). */
  aliases?: string[];
  features?: ServiceFeature[];
};

export type Catalog = {
  schemaVersion: number;
  version: string;
  services: ServiceCatalogEntry[];
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
  /** Last account selected in popup; restored on next popup open. */
  lastSelectedAccountId?: string;
};
