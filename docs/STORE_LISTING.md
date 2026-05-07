# Chrome Web Store listing copy

Reference text to paste into the Chrome Web Store developer dashboard at submission time. Update version + screenshot URLs as needed.

---

## Single-purpose statement

> AWS Shortcut helps users open the right AWS console — for the right account, role, and region — in one click, by reusing their existing IAM Identity Center (AWS SSO) browser session.

## Short description (≤132 chars)

> One-click access to AWS console accounts, roles, and services via your existing IAM Identity Center session. No CLI. No keys.

## Detailed description

Plain text only — Chrome Web Store does not render Markdown. Unicode bullets (•), blank lines for section breaks. Paste the block below verbatim into the dashboard.

```
One-click access to any AWS account, role, region, and service — straight from your browser. No CLI. No credentials on disk. No new login. Piggybacks on your existing IAM Identity Center (AWS SSO) browser session.


WHAT'S NEW IN 1.0.1

• Settings → Rescan portal. Pull a fresh account/role list from IAM Identity Center without re-onboarding.
• Settings → Change portal URL. Switch to a different IAM Identity Center portal without resetting the extension.
• Settings → Reset extension. One-click wipe back to a fresh-install state.
• Auto-close after launch (optional). New Settings toggle dismisses the side panel automatically the moment a console tab opens or refocuses. Off by default — flip it on if you only use the panel as a launcher.
• Close tabs from the panel. Every row in the Tabs list now has a one-click close button.


WHY

If you work across many AWS accounts, you know the dance: open IAM Identity Center, click your account, click the right role, wait for the federation redirect, finally land in the console, realize you wanted a different region, repeat.

AWS Shortcut collapses that into one click in a side panel. It reuses the AWS sign-in you already did — no second login, no proxy, no new identity provider.


WHAT IT DOES

• Fuzzy service search — type "lambda" to find Lambda. Type "instance" to find EC2 Instances. Ships with a catalog of every AWS service and the most common features inside each.
• One click → console open — pick account · role · region · service, and a console tab opens directly on that view.
• Multi-session aware — when you have AWS multi-session console enabled, it deep-links to the right <account>-<session>.region.console.aws.amazon.com subdomain so multiple accounts stay open simultaneously without signing each other out.
• Favorites — pin combos you use daily (Production · Lambda · Functions · us-east-1). Click → console.
• Recents — recently-closed AWS console tabs are remembered. Click → reopen.
• Close tabs from the panel — each row in the Tabs list has a one-click close button. The list updates instantly without waiting on Chrome.
• Account colors + region awareness — the panel mirrors the color band you set on each account in the AWS console, so production stands out from staging at a glance.
• Auto-close after launch (optional) — flip a toggle in Settings to dismiss the side panel automatically as soon as a console tab opens or refocuses. Off by default; turn it on if you want the panel to behave purely as a launcher.
• Keyboard shortcut — Cmd+Shift+A on macOS, Ctrl+Shift+A on Windows/Linux. Search-as-you-type, Enter to launch.


PRIVACY AND IDENTITY GUARANTEES

This is the part that matters.

• The extension does NOT replace AWS sign-in. You still log in to IAM Identity Center the normal way, in a normal AWS-hosted tab. The extension never sees your username, password, or MFA code.
• The extension is NOT an identity provider. It does not host an auth flow, does not proxy your credentials through any server, and does not run any backend. There are no servers operated by the extension authors — period.
• The extension does NOT store your SSO credentials. The bearer token your browser already sends to portal.sso.<region>.amazonaws.com is read in-memory inside the extension's service worker and held in chrome.storage.session (cleared when Chrome closes). Never written to disk in plaintext, never sent anywhere, never shared with another extension.
• No telemetry. No analytics. No remote logging. No ads. The extension does not phone home.
• All data stays on your device. Account list, role/region prefs, favorites, layout — all in chrome.storage.sync (Google syncs that across your own Chrome profile, encrypted in transit; nothing extra goes through the extension authors).
• Open source under MIT. Every line of code that touches your data is in the public repo. Audit before you trust.


FIRST-TIME SETUP (≈ 2 MINUTES)

1. Connect your access portal. Paste your IAM Identity Center start URL (looks like https://d-xxxxxxxxxx.awsapps.com/start/). You can find it in the AWS console under IAM Identity Center → Settings → AWS access portal URL. If you already have the portal open in another tab, the extension will auto-detect it.

2. Enable multi-session. For best results, turn on AWS multi-session console (top-right of console.aws.amazon.com → Multi-session → Turn on). Without this the extension still works — it falls back to the federation redirect every time, which is slower.

3. Scan. The extension calls the AWS portal API (the same one your browser already calls when you visit the portal) to enumerate the accounts and roles you have access to. The list is stored locally.


DAILY USE

1. Hit Cmd/Ctrl+Shift+A — side panel opens.
2. Pick an account (or it remembers the last one you used).
3. Type a service in the search box — "lambda", "s3", "cloudwatch logs", "instance", anything fuzzy.
4. Press Enter — a console tab opens at the right account, role, and region.

Refinements:

• Different role/region for one click — click the chip on the account row to change without setting a global default.
• Save a favorite — when the right combo is selected, hit Shift+Enter (or click the ☆ icon) to pin it.
• Reopen a closed tab — switch to the Tabs pill, then Recently closed. One click reopens at the same account/role/region.
• Reorder sections — drag section headers in the side panel; collapse what you don't need today.

You'll never type a password through this extension. The first time per browser session, AWS itself may ask you to re-authenticate (because IAM Identity Center bearer tokens expire) — that happens in the AWS-hosted portal tab, the same as without the extension.


HOW A CLICK BECOMES A CONSOLE TAB

Two paths, picked automatically:

1. Live session reuse — if you already have a multi-session console tab open for the target account, the extension builds a direct URL to the chosen service on that account's session subdomain and opens it. Instant — no redirect.

2. Identity portal launch — if no live session matches, the extension builds a federation URL through your IAM Identity Center start page that lands directly on the chosen service in the chosen account/role/region. AWS handles the sign-in (or reuses your existing portal cookies), then redirects to the right console URL.

Either way, you never re-enter credentials through the extension — AWS does the auth, the extension only assembles the right URL.


PERMISSIONS (WHY EACH ONE IS NEEDED)

• cookies — detect whether your multi-session AWS console subdomain has a live session. Only checks presence and expiry, never reads cookie values.
• webRequest — read the Authorization: Bearer header on outgoing portal API calls so the extension can call the same API on your behalf.
• declarativeNetRequest — rewrite Origin/Referer headers on extension-initiated requests so the portal API accepts them.
• tabs + scripting — discover open AWS console tabs and inject the small content script that observes account/role/region.
• sidePanel — the side-panel UI itself.
• storage, notifications, alarms — persist accounts/favorites/prefs locally, daily catalog refresh, "scan complete" notification.
• Host access to AWS endpoints (portal.sso.*.amazonaws.com, *.awsapps.com, *.console.aws.amazon.com, *.signin.aws.amazon.com) — the AWS endpoints the extension reads from.
• Host access to cdn.jsdelivr.net + raw.githubusercontent.com — service catalog refresh from a public repo.


OPEN SOURCE

MIT licensed. Source code, full privacy policy, issue tracker:

https://github.com/mceSystems/aws-shortcuts
```

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

## Promo video

No YouTube upload. Chrome Web Store renders a promo video only if a YouTube URL is supplied — leave the field blank. `docs/demo.gif` is shown on the README and GitHub repo page only; it is **not** uploaded to the Web Store listing.
