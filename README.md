<div align="center">
  <img src="src/assets/icons/icon-128.png" alt="AWS Shortcut" width="96" height="96" />

  # AWS Shortcut

  **One-click access to any AWS account, role, region, and service — straight from your browser.**

  No CLI. No credentials on disk. Piggybacks on your IAM Identity Center (AWS SSO) session.
</div>

---

<!-- Replace with a real recording once captured. See "Recording the demo" below. -->
<p align="center">
  <img src="docs/demo.gif" alt="AWS Shortcut demo" width="640" />
</p>

## Features

- **Side panel UI** — picks any account / role / region / service in 2–3 keystrokes.
- **Multi-session direct launch** — when AWS multi-session console is enabled, opens the target console URL directly, skipping the federation redirect.
- **Portal fallback** — automatically falls back to the IAM Identity Center federation flow when no live session matches.
- **Service search** — fuzzy-ranked catalog of all AWS services + common features. Bundled offline + auto-refreshed every 24h.
- **Favorites + recents** — pin frequently-used `account / role / region / service` combos. Reopen recently-closed console tabs in one click.
- **Tab observations** — detects color, role, and region of open console tabs to keep the UI in sync.
- **Keyboard shortcut** — `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Win/Linux) opens the side panel.
- **Privacy-first** — no telemetry, no external servers. SSO bearer never leaves the extension.

## Install

### Chrome Web Store

Coming soon.

### From source (manual unpacked)

```bash
git clone https://github.com/mceSystems/aws-shortcuts.git
cd aws-shortcuts
npm install
npm run build
```

Then:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** → select the `dist/` folder.
4. Pin the AWS Shortcut icon to your toolbar.

## First-time setup

1. Click the toolbar icon (or hit `Cmd/Ctrl+Shift+A`) to open the side panel.
2. **Connect** — paste your IAM Identity Center start URL (looks like `https://d-xxxxxxxxxx.awsapps.com/start/`). The extension will sign you in via the standard AWS portal.
3. **Multi-session check** — verify that AWS multi-session console is enabled on your portal. The panel guides you through the AWS toggle if not.
4. **Scan** — the extension reads your assigned accounts/roles from the portal API and stores them in `chrome.storage.sync` (synced across your Chrome profile).

You're done. Click any account row → pick a role → pick a service → console opens.

## How it works

```
   ┌──────────────┐    RESOLVE_LAUNCH_URL     ┌────────────────────┐
   │  Side panel  │ ────────────────────────► │  Service worker    │
   └──────────────┘                           │                    │
                                              │  • cookies probe   │
                                              │  • session cache   │
                                              │  • portal fallback │
                                              └─────────┬──────────┘
                                                        ▼
                                              direct console URL
                                              or federation redirect
```

- The service worker captures your portal SSO bearer token (read once from outgoing `Authorization: Bearer …` headers on `portal.sso.<region>.amazonaws.com`) to enumerate your accounts/roles via the portal API.
- A content script on `*.console.aws.amazon.com` reports the current account color band, role, region, and multi-session subdomain so the panel stays in sync with what you have open.
- Service catalog (`catalog/services.json`) is bundled with the extension and refreshed daily from this repo via jsDelivr CDN.

For a deeper architecture write-up, see [`design.md`](design.md) (UI spec) and [`docs/CATALOG.md`](docs/CATALOG.md) (catalog pipeline).

## Permissions

| Permission | Why |
|---|---|
| `cookies` | Detect a live AWS console session and skip the portal redirect. |
| `webRequest` | Read your portal SSO bearer (request headers only) to call the portal API. |
| `declarativeNetRequest` | Rewrite `Origin` / `Referer` headers — the portal API rejects `chrome-extension://` origins. |
| `tabs` + `scripting` | Observe open AWS console tabs for color/role/region context. |
| `sidePanel` | Primary UI surface. |
| `storage`, `notifications`, `alarms` | Persist accounts/favorites/prefs; daily catalog refresh. |
| Host access to `portal.sso.*.amazonaws.com`, `*.awsapps.com`, `*.console.aws.amazon.com`, `*.signin.aws.amazon.com` | Listed AWS endpoints the extension talks to. |
| Host access to `cdn.jsdelivr.net` + `raw.githubusercontent.com` | Service catalog refresh. |

No data is sent to third-party servers. The bearer token never leaves your machine.

## Development

```bash
npm install
npm run dev          # Vite dev server with HMR
npm run typecheck    # tsc --noEmit (panel + scripts)
npm run build        # production build → dist/
```

Load `dist/` as an unpacked extension while iterating.

### Service catalog updates

```bash
npm run catalog:auth        # Save a Playwright SSO session (one-time)
npm run catalog:services    # Harvest services from live AWS console
npm run catalog:features    # Harvest per-service features
npm run catalog:icons       # Build base64-encoded icon map
npm run catalog:all         # All of the above in sequence
```

See [`docs/CATALOG.md`](docs/CATALOG.md) for details.

### Recording the demo

The hero GIF lives at `docs/demo.gif`. Drop a fresh recording in that path to update.

Recommended tools (macOS):

- **[Kap](https://getkap.co)** — free, drag-to-record, exports straight to GIF. Pick this if you want zero friction.
- **QuickTime + `gifski`** — `Cmd+Shift+5` → record selection → export `.mov` → `gifski --fps 24 -o docs/demo.gif input.mov`.
- **[LICEcap](https://www.cockos.com/licecap/)** — old-school, lightweight, GIF-native.

Suggested capture (15–20 sec, ~640px wide):

1. Toolbar click → side panel opens.
2. Pick an account → role chip selects.
3. Type a service in search (e.g. `lambda`) → press Enter.
4. AWS console tab opens to the right service + region.
5. Re-open extension → click a favorite → another console launch.

Trim, target ~3–5 MB so it loads on slow connections.

## Contributing

PRs welcome. Before submitting:

- `npm run typecheck` must pass.
- `npm run build` must pass.
- Catalog changes go through `npm run catalog:*` scripts — don't hand-edit `catalog/services.json` for harvest-derived data (manual entries belong in [`catalog/overrides.json`](catalog/overrides.json)).

## License

[MIT](LICENSE) © MCE Systems
