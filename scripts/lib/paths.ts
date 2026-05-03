// Shared path constants for the CLI scripts. Single edit point if the layout
// shifts (e.g. cache moves out of repo, vendor pack version bumps).

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');

const CATALOG_DIR = resolve(ROOT, 'catalog');
export const SERVICES_PATH = resolve(CATALOG_DIR, 'services.json');
export const ICONS_PATH = resolve(CATALOG_DIR, 'icons.json');
export const OVERRIDES_PATH = resolve(CATALOG_DIR, 'overrides.json');

export const CACHE_DIR = resolve(ROOT, '.cache');
export const ICONS_VENDOR_DIR = resolve(CACHE_DIR, 'aws-icons-source/dist');
export const ICONS_TARBALL = (version: string) =>
  resolve(CACHE_DIR, `aws-icons-${version}.tar.gz`);
export const FEATURES_CHECKPOINT = resolve(CACHE_DIR, 'features-checkpoint.json');

const SCRIPTS_DIR = resolve(ROOT, 'scripts');
export const ICON_MAP_PATH = resolve(SCRIPTS_DIR, 'icon-map.json');
export const AUTH_DIR = resolve(SCRIPTS_DIR, '.auth');
export const AUTH_STATE = resolve(AUTH_DIR, 'state.json');

export const ICONS_VERSION = process.env.ICONS_VERSION ?? '18.0';
