#!/usr/bin/env tsx
// Orchestrator: run services → features → icons in sequence. Each phase is
// shelled out so a failure in one doesn't block the others — caller can
// retry the failing phase with its own flags.
//
// Flags:
//   --skip-services   skip update-services.ts
//   --skip-features   skip update-features.ts
//   --skip-icons      skip update-icons.ts
//   passthrough flags after `--` go to all phases (e.g. `--dry`).

import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const passIdx = argv.indexOf('--');
const phaseSkips = new Set(argv.slice(0, passIdx === -1 ? undefined : passIdx));
const passthrough = passIdx === -1 ? [] : argv.slice(passIdx + 1);

const phases: { name: string; skipFlag: string; script: string }[] = [
  { name: 'services', skipFlag: '--skip-services', script: 'scripts/update-services.ts' },
  { name: 'features', skipFlag: '--skip-features', script: 'scripts/update-features.ts' },
  { name: 'icons', skipFlag: '--skip-icons', script: 'scripts/update-icons.ts' },
];

function runPhase(script: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', script, ...passthrough], { stdio: 'inherit' });
    proc.on('close', (code) => resolve(code ?? 1));
    proc.on('error', (err) => {
      console.error(`[all] failed to spawn ${script}:`, err);
      resolve(1);
    });
  });
}

async function main(): Promise<void> {
  let failed = 0;
  for (const phase of phases) {
    if (phaseSkips.has(phase.skipFlag)) {
      console.log(`[all] skipping ${phase.name}`);
      continue;
    }
    console.log(`\n[all] === ${phase.name} ===`);
    const code = await runPhase(phase.script);
    if (code !== 0) {
      console.error(`[all] ${phase.name} exited ${code}`);
      failed++;
    }
  }
  if (failed) {
    console.error(`[all] ${failed} phase(s) failed`);
    process.exit(1);
  }
  console.log('\n[all] done. review with: git diff catalog/');
}

main();
