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

export type IdentityCenter = {
  /** Stable id derived from portalHost on creation (e.g. `d-xxxxxx-awsapps-com`). */
  id: string;
  /** User-editable display label. Defaults to portal hostname. */
  name: string;
  startUrl: string;
  portalHost: string;
  /** Portal API region (where portal.sso.<region>.amazonaws.com lives). */
  region: string;
};

export type Account = {
  /** Which Identity Center this row belongs to. Composite identity is
   * (identityCenterId, accountId): same AWS account reachable from two
   * Identity Centers shows as two distinct rows with different role sets. */
  identityCenterId: string;
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
  identityCenterId: string;
  accountId: string;
  roleName: string;
  region: string;
  serviceId: string;
  featurePath?: string;
  /** Path + query (no `region=`) + hash. Round-trips through RESOLVE_LAUNCH_URL. */
  consolePath: string;
  label: string;
  createdAt: number;
};

export type Recent = {
  id: string;
  identityCenterId: string;
  accountId: string;
  roleName: string;
  region: string;
  serviceId: string;
  /** Path + query (no `region=`) + hash. Round-trips through RESOLVE_LAUNCH_URL. */
  consolePath: string;
  /** Stable key — same resource id across volatile view params. */
  dedupeKey: string;
  /** Original URL the tab held when it was closed. Display only. */
  url: string;
  title?: string;
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
  multiSessionVerified: boolean;
  catalogLastRefreshAt?: number;
  /** Last account selected; restored on next side-panel open. */
  lastSelectedAccountId?: string;
  /** When true, closes the side panel automatically after a successful
   *  service/feature launch (new tab or refocus). Off by default. */
  autoCloseOnOpen?: boolean;
};
