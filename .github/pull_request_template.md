<!--
Thanks for opening a PR! See CONTRIBUTING.md for the full quality bar.
-->

## What this changes

<!-- Short description. Link the issue if applicable. -->

## Why

<!-- The motivation. Skip if obvious from the title. -->

## How to test

<!--
1. Run `npm run build`.
2. Reload the unpacked extension in chrome://extensions.
3. Click through the affected flow.
-->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Loaded `dist/` as unpacked extension and verified the change manually
- [ ] No new `console.log` calls
- [ ] No new outbound network destinations (or `manifest.ts` host_permissions + PRIVACY.md updated)
- [ ] No AWS trademarks introduced
