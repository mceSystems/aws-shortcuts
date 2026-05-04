# Chrome Web Store listing copy

Reference text to paste into the Chrome Web Store developer dashboard at submission time. Update version + screenshot URLs as needed.

---

## Single-purpose statement

> AWS Shortcut helps users open the right AWS console — for the right account, role, and region — in one click, by reusing their existing IAM Identity Center (AWS SSO) browser session. The extension does not host an authentication flow of its own; it assembles the right console URL and lets AWS handle sign-in.

## Short description (≤132 chars)

> One-click access to AWS console accounts, roles, and services via your existing IAM Identity Center session. No CLI. No keys.

## Detailed description

> AWS Shortcut is a focused productivity tool for engineers who use AWS IAM Identity Center (formerly AWS SSO) and switch between many accounts, roles, and regions every day.
>
> What it does:
>
> • Side panel UI to pick any account, role, region, and service in 2–3 keystrokes.
> • When AWS multi-session console is enabled, opens the target service URL directly in a new tab — no federation redirect.
> • Falls back to the standard IAM Identity Center federation flow when no live session matches.
> • Fuzzy-ranked search across all AWS services and common features (e.g. EC2 → Instances, Lambda → Functions).
> • Pin frequently-used account/role/region/service combos as Favorites.
> • Reopen recently-closed AWS console tabs in one click.
> • Keyboard shortcut Cmd/Ctrl+Shift+A.
>
> Privacy:
>
> • Runs entirely on your device. No telemetry, no analytics, no remote logging.
> • The extension talks only to the AWS endpoints you already use, plus a public CDN to refresh its bundled service catalog once a day.
> • Your SSO bearer token never leaves your browser.
>
> Open source under the MIT license. Source and full privacy policy at:
> https://github.com/mceSystems/aws-shortcuts

## Category

`Developer Tools`

## Permission justifications

Paste each block into its own field on the Privacy practices tab. Every required permission has its own field.

### Host permissions

> The extension reads from the AWS endpoints the user already accesses through their browser:
> - `portal.sso.<region>.amazonaws.com` and `*.awsapps.com` — list the user's accounts and roles via the IAM Identity Center portal API, using the same bearer token the browser already sends.
> - `*.console.aws.amazon.com` and `*.signin.aws.amazon.com` — open the target console URL after a user click, observe the user's open console tabs to keep the side panel in sync (account ID, role, region, color band), and detect when a session ends.
> - `cdn.jsdelivr.net` and `raw.githubusercontent.com` — fetch the public service catalog JSON from the extension's GitHub repo on a once-per-24-hour schedule.
>
> No other hosts are contacted, and no data is sent to servers operated by the extension authors.

### `alarms`

> Schedule a once-per-24-hour background refresh of the bundled AWS service catalog from the extension's public GitHub repository (via the jsDelivr CDN) so the in-extension service search stays current with new AWS services.

### `cookies`

> Detect whether the user already has a live AWS console session for a given multi-session subdomain. The extension only inspects the presence and expiry timestamp of cookies on AWS console hosts to decide whether to deep-link directly to the console or fall back to the AWS federation redirect. Cookie values are never read.

### `declarativeNetRequest`

> Required to register a single dynamic rule that rewrites the `Origin` and `Referer` headers on extension-initiated XHRs hitting the AWS portal API. The portal API rejects requests with `Origin: chrome-extension://...`, so without this rule the API will not respond. The rule's `condition` pins `initiatorDomains` to this extension's ID, restricts `resourceTypes` to `XMLHTTPREQUEST`, and uses `urlFilter: 'portal.sso.'` to target the redirected leg of the portal call (the AWS SSO start URL on `awsapps.com` redirects to `portal.sso.<region>.amazonaws.com` and that's where the rewrite is needed). Because `initiatorDomains` pins to this extension, the rule cannot fire on any traffic the extension did not itself originate.

### `declarativeNetRequestWithHostAccess`

> Required so the same `Origin`/`Referer`-rewrite rule above can target host-specific URLs (the user's configured AWS portal host) rather than only generic header transforms. No other use.

### `scripting`

> The extension declares a content script for `https://*.console.aws.amazon.com/*` in its manifest, so Chrome auto-injects it on AWS console tabs at `document_idle`. The script reads visible page chrome (account ID, role, region, color band, multi-session subdomain) and reports it back to the side panel so the panel stays in sync with what the user has open. The `scripting` permission itself is used only as a fallback: when the service worker re-harvests already-open tabs (e.g. on extension update or re-enable) and the auto-injected script is not yet present, `chrome.scripting.executeScript` re-injects the same bundled script file. The script does not modify page content; it only patches `history.pushState`/`history.replaceState` so it can observe SPA navigations within the AWS console. No data is sent off-device.

### `sidePanel`

> The primary user interface of the extension is a Chrome side panel. This permission is required to register and open it.

### `storage`

> Persist the user's IAM Identity Center start URL, list of accounts and roles, role/region preferences, favorites, recently-closed tabs, and side-panel layout. Stored in `chrome.storage.sync` (account/prefs), `chrome.storage.local` (recents and bundled catalog), and `chrome.storage.session` (the bearer token, cleared when Chrome closes). Nothing is written outside Chrome's extension storage.

### `tabs`

> Discover open AWS console tabs so the side panel can show them, observe their URL/title, and reopen recently-closed ones at the same account/role/region. Also used to launch the chosen console URL in a new tab when the user clicks an account/service combination.

### `webNavigation`

> Detect when an open AWS console tab navigates away to the signin or IAM Identity Center start URL — that signals the multi-session console session for that account has ended, and the extension drops the matching session entry from its local store so future clicks don't try to reuse a dead session.

### `webRequest`

> Read the `Authorization: Bearer` header on outgoing requests to `portal.sso.<region>.amazonaws.com` so the extension can call the same AWS portal API on the user's behalf to enumerate their assigned accounts and roles. Only request headers on portal hosts are inspected; the bearer token is never sent off the device. The extension does not block, redirect, or modify network traffic via webRequest.

## Remote code

> **Answer: No, I am not using remote code.**
>
> All JavaScript is bundled inside the extension package. The only remote fetch is a JSON service catalog (data, not executed as code). No `eval`, no remote `<script>`, no dynamic `import()`.

## Data collection disclosures

Tick exactly these three on the form:

- ☑ **Authentication information** — the IAM Identity Center bearer token, held in `chrome.storage.session` (cleared when Chrome closes), never sent off-device.
- ☑ **Web history** — URLs/titles of the user's open AWS console tabs, used for tab observations and the recently-closed list.
- ☑ **Website content** — the content script reads small DOM bits on `*.console.aws.amazon.com` (account color band, role name, region) and reports them to the side panel.

Leave everything else unticked. The extension does not collect PII, health, financial, location, communications, or user-activity data.

Tick all three certifications:

- ☑ I do not sell or transfer user data to third parties (outside approved use cases).
- ☑ I do not use or transfer user data for purposes unrelated to the item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending.

## Privacy policy URL

> https://github.com/mceSystems/aws-shortcuts/blob/main/PRIVACY.md

## Homepage URL

> https://github.com/mceSystems/aws-shortcuts

## Support URL

> https://github.com/mceSystems/aws-shortcuts/issues

## Required listing assets

| Asset | Spec | Status |
|---|---|---|
| Store icon | 128×128 PNG | [`src/assets/icons/icon-128.png`](../src/assets/icons/icon-128.png) ✓ |
| Screenshot 1 (hero) | 1280×800 PNG | [`docs/screenshots/01-hero.png`](screenshots/01-hero.png) ✓ |
| Screenshot 2 (money shot) | 1280×800 PNG | [`docs/screenshots/02-money-shot.png`](screenshots/02-money-shot.png) ✓ |
| Screenshot 3 (onboarding) | 1280×800 PNG | [`docs/screenshots/03-onboarding-connect.png`](screenshots/03-onboarding-connect.png) ✓ |
| Small promo tile | 440×280 PNG/JPEG | optional, skip for v1 |
| Marquee promo tile | 1400×560 | optional, skip for v1 |
