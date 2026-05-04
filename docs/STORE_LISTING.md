# Chrome Web Store listing copy

Reference text to paste into the Chrome Web Store developer dashboard at submission time. Update version + screenshot URLs as needed.

---

## Single-purpose statement

> AWS Shortcut helps users open the right AWS console — for the right account, role, and region — in one click, by reusing their existing IAM Identity Center (AWS SSO) browser session.

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

Paste these into the dashboard form, one per permission, when prompted.

### Host permissions

> The extension needs to talk to your IAM Identity Center portal (`portal.sso.<region>.amazonaws.com`, `*.awsapps.com`) to list the accounts and roles you have access to, and to the AWS console (`*.console.aws.amazon.com`, `*.signin.aws.amazon.com`) to launch the right URL when you click. It also fetches the bundled service catalog from the public jsDelivr CDN (`cdn.jsdelivr.net`) and GitHub raw (`raw.githubusercontent.com`) once a day.

### `cookies`

> Used to detect whether a multi-session AWS console tab is live before launching, so we can deep-link to the direct console URL instead of routing through the slower federation redirect. The extension only checks for the presence and expiry of cookies on AWS console subdomains. It never reads cookie values.

### `webRequest`

> Used to read the `Authorization: Bearer` request header on outgoing requests to the AWS portal API (`portal.sso.*.amazonaws.com`). The extension uses that bearer token to call the same portal API your browser already calls, in order to enumerate your assigned accounts and roles. The token never leaves your device.

### `declarativeNetRequest` / `declarativeNetRequestWithHostAccess`

> Used to rewrite the `Origin` and `Referer` headers on extension-initiated requests to the AWS portal API. The portal API rejects requests with `Origin: chrome-extension://...`; without this rewrite, the API will not respond. The rule is scoped to the portal hosts only.

### `tabs` / `scripting`

> Used to detect open AWS console tabs and inject a small content script on `*.console.aws.amazon.com` that observes the current tab's account ID, role name, region, color band, and multi-session subdomain. This keeps the side panel in sync with what's already open and lets the extension correctly identify which account a tab belongs to.

### `sidePanel`

> The primary user interface — the side panel itself.

### `storage`

> Persists the user's portal config, account list, role/region preferences, favorites, and side-panel layout in `chrome.storage.sync`. Persists recently-closed tab history in `chrome.storage.local`. Holds the bearer token in `chrome.storage.session` for the lifetime of the browser session.

### `notifications`

> Surfaces a single non-blocking notification when an account scan finishes, so the user knows when the panel is ready.

### `alarms`

> Schedules the once-per-24-hour service catalog refresh from the public CDN.

## Privacy policy URL

> https://github.com/mceSystems/aws-shortcuts/blob/main/PRIVACY.md

## Homepage URL

> https://github.com/mceSystems/aws-shortcuts

## Support URL

> https://github.com/mceSystems/aws-shortcuts/issues

## Required listing assets

| Asset | Spec | Status |
|---|---|---|
| Store icon | 128×128 PNG | `src/assets/icons/icon-128.png` ✓ |
| Screenshot | 1280×800 or 640×400 PNG/JPEG, ≥1, up to 5 | TODO — capture sidepanel + console launch |
| Small promo tile | 440×280 PNG/JPEG | optional but recommended |
| Marquee promo tile | 1400×560 | optional |

## Screenshot capture plan

Aim for 3–5 screenshots, 1280×800 each.

1. **Hero** — sidepanel open with account list + service search active, on a real-looking Chrome window.
2. **Service search** — query `lambda` showing fuzzy-ranked results + feature dropdown.
3. **Favorites** — populated favorites list with custom labels.
4. **Tabs/recents** — recently-closed tab list ready to relaunch.
5. **Onboarding** — connect step with placeholder portal URL.

Capture flow on macOS:

```
Cmd+Shift+4 → Space → click Chrome window → save
```

Crop to 1280×800 if needed. Use a clean Chrome profile (no personal bookmarks, no other extension icons).
