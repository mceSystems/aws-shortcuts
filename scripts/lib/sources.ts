// External data sources for catalog enrichment. Each source is independently
// fetchable and failures are isolated — one bad source must not abort the
// whole update.

const BOTOCORE_ENDPOINTS_URL =
  'https://raw.githubusercontent.com/boto/botocore/master/botocore/data/endpoints.json';

type EndpointsData = {
  partitions: Array<{
    partition: string;
    services: Record<
      string,
      {
        partitionEndpoint?: string;
        isRegionalized?: boolean;
        endpoints?: Record<string, unknown>;
      }
    >;
  }>;
};

let endpointsCache: EndpointsData | null = null;

async function fetchBotocoreEndpoints(): Promise<EndpointsData> {
  if (endpointsCache) return endpointsCache;
  const res = await fetch(BOTOCORE_ENDPOINTS_URL);
  if (!res.ok) throw new Error(`botocore endpoints HTTP ${res.status}`);
  const data = (await res.json()) as EndpointsData;
  endpointsCache = data;
  return data;
}

/** Map of botocore service code → isRegionalized flag (`global=true` when
 *  isRegionalized is explicitly false). Pulled from the AWS partition only. */
async function fetchGlobalServiceMap(): Promise<Map<string, boolean>> {
  const data = await fetchBotocoreEndpoints();
  const aws = data.partitions.find((p) => p.partition === 'aws');
  const out = new Map<string, boolean>();
  if (!aws) return out;
  for (const [code, svc] of Object.entries(aws.services)) {
    out.set(code, svc.isRegionalized === false);
  }
  return out;
}

/** Best-effort id mapping. Catalog ids don't always match botocore service
 *  codes — extend this map when a discrepancy is observed. */
const CATALOG_TO_BOTOCORE: Record<string, string> = {
  ec2: 'ec2',
  s3: 's3',
  iam: 'iam',
  cloudwatch: 'monitoring',
  cloudfront: 'cloudfront',
  route53: 'route53',
  organizations: 'organizations',
  billing: 'billing',
  cloudtrail: 'cloudtrail',
  sso: 'sso',
  artifact: 'artifact',
  trustedadvisor: 'trustedadvisor',
  marketplace: 'aws-marketplace',
  shield: 'shield',
  waf: 'waf',
  globalaccelerator: 'globalaccelerator',
  costexplorer: 'ce',
  costmanagement: 'ce',
  health: 'health',
  support: 'support',
  resourcegroups: 'resource-groups',
};

/** Hard-coded global services — used when botocore lookup is ambiguous or
 *  the service isn't in endpoints.json. */
const KNOWN_GLOBAL = new Set([
  'iam',
  'route53',
  'cloudfront',
  'organizations',
  'billing',
  'sso',
  'artifact',
  'trustedadvisor',
  'marketplace',
  'shield',
  'globalaccelerator',
  'support',
  'wafclassic',
  'wavelength',
  'partnercentral',
  'health',
  'costexplorer',
  'costmanagement',
  'controltower',
]);

export async function isGlobalService(catalogId: string): Promise<boolean> {
  if (KNOWN_GLOBAL.has(catalogId)) return true;
  try {
    const map = await fetchGlobalServiceMap();
    const code = CATALOG_TO_BOTOCORE[catalogId] ?? catalogId;
    return map.get(code) === true;
  } catch {
    return false;
  }
}
