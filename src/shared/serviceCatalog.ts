import type { ServiceCatalogEntry, ServiceFeature } from './types';
import { scoreMatch } from './fuzzy';
import { getServicesSnapshot } from './catalogStore';

export function findServiceById(id: string): ServiceCatalogEntry | undefined {
  return getServicesSnapshot().find((s) => s.id === id);
}

export type CatalogHit =
  | { kind: 'service'; service: ServiceCatalogEntry; score: number }
  | { kind: 'feature'; service: ServiceCatalogEntry; feature: ServiceFeature; score: number };

const FEATURE_WEIGHT = 0.85;
const SERVICE_TIE_BONUS = 0.5;

export function searchCatalog(query: string, limit = 8): CatalogHit[] {
  const services = getServicesSnapshot();
  if (!query.trim()) {
    return services.slice(0, limit).map((service) => ({ kind: 'service' as const, service, score: 0 }));
  }
  const hits: CatalogHit[] = [];
  for (const service of services) {
    const sFields = [service.id, service.name, ...(service.aliases ?? [])];
    const sScore = scoreMatch(query, ...sFields);
    if (sScore != null) {
      hits.push({ kind: 'service', service, score: sScore + SERVICE_TIE_BONUS });
    }
    if (!service.features) continue;
    for (const feature of service.features) {
      const fScore = scoreMatch(query, feature.name, `${service.name} ${feature.name}`);
      if (fScore == null) continue;
      hits.push({ kind: 'feature', service, feature, score: fScore * FEATURE_WEIGHT });
    }
  }
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return labelOf(a).localeCompare(labelOf(b));
  });
  return hits.slice(0, limit);
}

function labelOf(hit: CatalogHit): string {
  return hit.kind === 'service' ? hit.service.name : `${hit.service.name} ${hit.feature.name}`;
}

/** Back-compat shim for legacy callers. */
export type ServiceSearchHit = { service: ServiceCatalogEntry; score: number };
export function searchServices(query: string, limit = 8): ServiceSearchHit[] {
  return searchCatalog(query, limit)
    .filter((h): h is Extract<CatalogHit, { kind: 'service' }> => h.kind === 'service')
    .map((h) => ({ service: h.service, score: h.score }));
}
