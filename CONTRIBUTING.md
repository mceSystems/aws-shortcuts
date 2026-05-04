# Contributing to AWS Shortcut

Thanks for your interest. This is an open-source project — contributions of all sizes are welcome.

## Ground rules

- **Scope:** the extension is a focused tool for fast SSO-based AWS console access. Features that broaden the scope (general AWS dashboards, IAM management UIs, billing, etc.) are out of scope unless they directly accelerate the "open the right console fast" workflow.
- **Privacy first:** no telemetry, no analytics, no remote logging. Any change that adds outbound traffic must be justified and documented in [PRIVACY.md](PRIVACY.md).
- **No AWS trademarks in icons or branding.** The extension is not affiliated with AWS or Amazon.
- **MV3 only.** No request to fall back to MV2.

## Development setup

```bash
git clone https://github.com/mceSystems/aws-shortcuts.git
cd aws-shortcuts
npm install
npm run dev
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode**.
3. **Load unpacked** → select `dist/` (run `npm run build` first if `dist/` is empty).
4. Pin the extension icon. Reload the extension after Vite rebuilds.

## Quality bar before opening a PR

Run locally and confirm both pass:

```bash
npm run typecheck
npm run build
```

CI runs the same two commands on every PR.

## Code conventions

- TypeScript `strict` is on, `noUnusedLocals` / `noUnusedParameters` are on. No `any` unless you have a comment explaining why.
- Prefer editing existing files over creating new ones.
- React/Preact: hooks for state, no class components, no third-party state libraries (Redux, Zustand, etc.) — keep the dependency surface small. The build aliases `react` to `preact/compat` for ~140KB savings; use the React API and let the alias do the work.
- CSS modules for component styles. Tokens live in [`src/styles/tokens.css`](src/styles/tokens.css) — see [`design.md`](design.md) for the design system spec.
- Don't add comments that just restate the code. Add a comment when there's a non-obvious WHY (a constraint, an invariant, a workaround for a specific bug).
- Don't add backwards-compatibility shims, feature flags, or "removed" comments — just change the code.
- Don't re-introduce `console.log` calls in committed code. Use `console.warn`/`console.error` only in real error paths.

## Catalog changes

The service catalog (`catalog/services.json`) is the source of truth for what the search shows. There are two valid ways to change it:

1. **Manual** — edit [`catalog/overrides.json`](catalog/overrides.json) for aliases, name overrides, exclusions, and global-flag overrides. Re-run `npm run catalog:services -- --no-playwright` to merge overrides into `catalog/services.json`. Commit both files.
2. **Harvest** — re-scrape from the live AWS console to pick up new services / nav changes:

   ```bash
   npm run catalog:auth        # one-time SSO sign-in via Playwright
   npm run catalog:all         # services + features + icons
   ```

   Diffs come out of `npm run catalog:all` — review them before committing.

See [`docs/CATALOG.md`](docs/CATALOG.md) for the full pipeline. **Do not hand-edit harvest-derived data in `services.json`**; put manual fixes in `overrides.json` so the next harvest doesn't clobber them.

## Pull request checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] You manually loaded the unpacked `dist/` and clicked through the affected flow
- [ ] No new `console.log` or other debug noise
- [ ] No new outbound network destinations (or, if there are, you've updated `manifest.ts` host_permissions and [PRIVACY.md](PRIVACY.md))
- [ ] No AWS trademarks introduced in icons, screenshots, or copy

Small, focused PRs land faster than big ones.

## Reporting bugs

Open an issue at <https://github.com/mceSystems/aws-shortcuts/issues>. Useful bug reports include:

- Chrome version
- Extension version (from `chrome://extensions`)
- Region of your IAM Identity Center portal (e.g. `us-east-1`)
- Steps to reproduce
- Anything from the side panel's DevTools console (right-click panel → Inspect)

For security issues, **do not open a public issue** — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
