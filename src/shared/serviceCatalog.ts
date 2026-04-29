import type { ServiceCatalogEntry } from './types';
import { scoreMatch } from './fuzzy';
import services from '@/data/services.json';

export const SERVICE_CATALOG = services as ServiceCatalogEntry[];

const BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s]));

export function findServiceById(id: string): ServiceCatalogEntry | undefined {
  return BY_ID.get(id);
}

export type ServiceSearchHit = {
  service: ServiceCatalogEntry;
  score: number;
};

export function searchServices(query: string, limit = 8): ServiceSearchHit[] {
  if (!query.trim()) {
    // Empty query → return first N alphabetically as default suggestions.
    return SERVICE_CATALOG.slice(0, limit).map((service) => ({ service, score: 0 }));
  }
  const hits: ServiceSearchHit[] = [];
  for (const service of SERVICE_CATALOG) {
    const score = scoreMatch(query, service.id, service.name);
    if (score == null) continue;
    hits.push({ service, score });
  }
  hits.sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name));
  return hits.slice(0, limit);
}
