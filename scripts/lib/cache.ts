// Cache helpers for the CLI scripts. .cache/ is git-ignored; persists between
// runs to avoid re-downloading vendor packs and large fixtures.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { CACHE_DIR, ICONS_TARBALL, ICONS_VENDOR_DIR, ICONS_VERSION } from './paths';

function ensureCacheDir(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
}

export async function ensureIconsVendor(version: string = ICONS_VERSION): Promise<void> {
  const dist = ICONS_VENDOR_DIR;
  if (existsSync(dist) && statSync(dist).isDirectory()) return;

  ensureCacheDir();
  const tarball = ICONS_TARBALL(version);

  if (!existsSync(tarball) || statSync(tarball).size === 0) {
    const url = `https://github.com/awslabs/aws-icons-for-plantuml/archive/refs/tags/v${version}.tar.gz`;
    console.log(`[cache] GET ${url}`);
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok || !res.body) {
      throw new Error(`tarball download failed: HTTP ${res.status}`);
    }
    const tmp = `${tarball}.partial`;
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
    renameSync(tmp, tarball);
    console.log(`[cache] saved ${(statSync(tarball).size / 1024 / 1024).toFixed(1)} MB`);
  }

  const vendorRoot = dirname(dist);
  if (existsSync(vendorRoot)) rmSync(vendorRoot, { recursive: true, force: true });
  mkdirSync(vendorRoot, { recursive: true });

  await new Promise<void>((resolveP, reject) => {
    const proc = spawn(
      'tar',
      [
        '-xzf',
        tarball,
        '-C',
        vendorRoot,
        '--strip-components=1',
        `aws-icons-for-plantuml-${version}/dist`,
      ],
      { stdio: 'inherit' },
    );
    proc.on('close', (code) => (code === 0 ? resolveP() : reject(new Error(`tar exited ${code}`))));
    proc.on('error', reject);
  });
  console.log(`[cache] extracted vendor icons → ${dist}`);
}
