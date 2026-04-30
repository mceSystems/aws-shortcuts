import type { ServiceCatalogEntry } from './types';
import { scoreMatch } from './fuzzy';
import { getServicesSnapshot } from './catalogStore';

export function findServiceById(id: string): ServiceCatalogEntry | undefined {
  return getServicesSnapshot().find((s) => s.id === id);
}

export type ServiceSearchHit = {
  service: ServiceCatalogEntry;
  score: number;
};

export function searchServices(query: string, limit = 8): ServiceSearchHit[] {
  const services = getServicesSnapshot();
  if (!query.trim()) {
    return services.slice(0, limit).map((service) => ({ service, score: 0 }));
  }
  const hits: ServiceSearchHit[] = [];
  for (const service of services) {
    const score = scoreMatch(query, service.id, service.name);
    if (score == null) continue;
    hits.push({ service, score });
  }
  hits.sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name));
  return hits.slice(0, limit);
}
