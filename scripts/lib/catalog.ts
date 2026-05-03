// Catalog read/write helpers. Single source of truth for schema shape +
// serialization rules. All update-* scripts go through these so the on-disk
// format never drifts.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ICONS_PATH, OVERRIDES_PATH, SERVICES_PATH } from './paths';

export type Feature = { name: string; path: string };
export type Service = {
  id: string;
  name: string;
  consolePath: string;
  popular?: boolean;
  global?: boolean;
  aliases?: string[];
  features?: Feature[];
};
type Catalog = {
  schemaVersion: number;
  version: string;
  services: Service[];
};

type Overrides = {
  aliases?: Record<string, string[]>;
  consolePathOverrides?: Record<string, string>;
  nameOverrides?: Record<string, string>;
  exclude?: string[];
  popular?: string[];
  /** Manual fallback when auto-detection misclassifies. */
  globalOverrides?: Record<string, boolean>;
};

export type IconsMap = Record<string, string>;

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readCatalog(): Catalog {
  return readJson<Catalog>(SERVICES_PATH);
}

export function readIcons(): IconsMap {
  if (!existsSync(ICONS_PATH)) return {};
  return readJson<IconsMap>(ICONS_PATH);
}

export function readOverrides(): Overrides {
  if (!existsSync(OVERRIDES_PATH)) return {};
  const raw = readJson<Overrides & Record<string, unknown>>(OVERRIDES_PATH);
  delete raw['$schema'];
  return raw;
}

export function writeCatalog(c: Catalog): void {
  writeFileSync(SERVICES_PATH, JSON.stringify(c, null, 2) + '\n');
}

export function writeIcons(icons: IconsMap): void {
  // Stable key order so diffs are minimal across runs.
  const sorted: IconsMap = {};
  for (const k of Object.keys(icons).sort()) sorted[k] = icons[k];
  writeFileSync(ICONS_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

export function todayVersion(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function sortServices(services: Service[]): Service[] {
  return [...services].sort((a, b) => a.name.localeCompare(b.name));
}
