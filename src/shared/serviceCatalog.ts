import type { ServiceCatalogEntry, ServiceFeature } from './types';
import { scoreMatch } from './fuzzy';
import { getServicesSnapshot } from './catalogStore';
import { featureKey } from './openCounts';

export function findServiceById(id: string): ServiceCatalogEntry | undefined {
  return getServicesSnapshot().find((s) => s.id === id);
}

export type CatalogHit =
  | { kind: 'service'; service: ServiceCatalogEntry; score: number; popular: boolean; openCount: number }
  | { kind: 'feature'; service: ServiceCatalogEntry; feature: ServiceFeature; score: number; popular: boolean; openCount: number };

export type RankCtx = {
  /** chrome.storage.local.openCounts snapshot keyed by serviceId or featureKey. */
  openCounts?: Record<string, number>;
};

const FEATURE_WEIGHT = 0.85;
const SERVICE_TIE_BONUS = 0.5;
const POPULAR_BONUS = 25;
// Saturating boost: 1 open ≈ +5.5, 5 ≈ +14, 25 ≈ +25, 100 ≈ +37.
function openBoost(count: number): number {
  return count > 0 ? Math.log(count + 1) * 8 : 0;
}

export function rankCatalog(query: string, ctx: RankCtx = {}, limit = Infinity): CatalogHit[] {
  const services = getServicesSnapshot();
  const counts = ctx.openCounts ?? {};
  const q = query.trim();

  if (!q) {
    // Empty query: order by popular + open count (descending), name ascending.
    const all: CatalogHit[] = services.map((service) => ({
      kind: 'service' as const,
      service,
      score: 0,
      popular: service.popular === true,
      openCount: counts[service.id] ?? 0,
    }));
    all.sort((a, b) => emptyScore(b) - emptyScore(a) || a.service.name.localeCompare(b.service.name));
    return all.slice(0, limit);
  }

  // Per-service grouping rule: if the service itself matches the query,
  // surface ONLY the service row (its features are reachable via the
  // feature picker on Enter/click). Features surface as their own rows
  // only when the parent service didn't match — that way feature search
  // ("logs insights" → CloudWatch › Logs Insights) still works without
  // double-listing every CloudWatch sub-page when the user types
  // "cloudwatch".
  const hits: CatalogHit[] = [];
  for (const service of services) {
    const sFields = [service.id, service.name, ...(service.aliases ?? [])];
    const sScore = scoreMatch(q, ...sFields);
    if (sScore != null) {
      const openCount = counts[service.id] ?? 0;
      hits.push({
        kind: 'service',
        service,
        score:
          sScore +
          SERVICE_TIE_BONUS +
          (service.popular ? POPULAR_BONUS : 0) +
          openBoost(openCount),
        popular: service.popular === true,
        openCount,
      });
      // Service matched → suppress its features.
      continue;
    }
    if (!service.features) continue;
    for (const feature of service.features) {
      const fScore = scoreMatch(q, feature.name, `${service.name} ${feature.name}`);
      if (fScore == null) continue;
      const openCount = counts[featureKey(service.id, feature.path)] ?? 0;
      hits.push({
        kind: 'feature',
        service,
        feature,
        score:
          fScore * FEATURE_WEIGHT +
          (service.popular ? POPULAR_BONUS * 0.4 : 0) +
          openBoost(openCount),
        popular: service.popular === true,
        openCount,
      });
    }
  }
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return labelOf(a).localeCompare(labelOf(b));
  });
  return hits.slice(0, limit);
}

function emptyScore(hit: CatalogHit): number {
  return (hit.popular ? POPULAR_BONUS : 0) + openBoost(hit.openCount);
}

function labelOf(hit: CatalogHit): string {
  return hit.kind === 'service' ? hit.service.name : `${hit.service.name} ${hit.feature.name}`;
}

/** Back-compat shim. Prefer rankCatalog directly. */
export function searchCatalog(query: string, limit = Infinity): CatalogHit[] {
  return rankCatalog(query, {}, limit);
}
