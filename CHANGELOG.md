# Changelog

All notable changes to AWS Shortcut are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [1.0.3] — 2026-05-15

### Added
- **Multiple Identity Centers.** Connect more than one IAM Identity Center portal at a time. The same AWS account reachable from two portals shows up as two rows so you can pick the role/portal you actually want. Add additional portals from Settings → Identity Centers → *Add Identity Center*; rename or remove any of them from the same list.
- **Per-Identity-Center settings.** Each connected portal is its own row in Settings with its own rename, rescan, and remove actions — no more global "current portal" assumption.

### Fixed
- **Settings panel no longer bounces back to Main after onboarding.** A stale in-flight scan callback fired after `ScanStep` had unmounted, calling `onComplete` from a dead closure and snapping `phase` back to `ready` 1–2 seconds after the user opened Settings. All async paths in `ScanStep` now check a mount-state ref before touching state or invoking `onComplete`.
- **Reset confirmation now scrolls into view.** Clicking *Reset extension* in Settings auto-scrolls the inline confirm box into view instead of leaving it hidden below the fold.
- **Scan robustness on initial onboarding.** Misc fixes to the bg-tab capture + scan flow that surfaced when adding multi-IDC support.

## [1.0.2] — 2026-05-08

### Fixed
- **Onboarding portal suggestions update live.** The "Connect your access portal" step now refreshes its open-tab suggestion list whenever a portal tab is opened, navigated, or closed — no more stepping Back and Next to see a portal you just opened.
- **Scan no longer hangs when portal tab is focused.** Capture-and-scan reloads any existing portal tab regardless of focus, so a fresh bearer token is captured every time. Previously, if the portal tab was the user's focused tab and no bearer was cached (e.g. after Reset extension), scanning would stall on "Waiting for portal…" until the user manually refreshed the portal page.
- **Launch always opens the requested role.** When an account already had one role open in another tab, launching a *different* role on the same account could land on the existing role instead. The direct-launch fallback used to match by account ID only and reuse whatever subdomain was already open; it now requires a verified role match before reusing a session, and falls back to a fresh portal launch otherwise.

## [1.0.1] — 2026-05-07

### Added
- **Rescan portal from Settings.** Re-pull your account list from IAM Identity Center without re-onboarding — picks up new accounts, removed accounts, and role changes.
- **Change portal URL from Settings.** Switch to a different IAM Identity Center portal without going through a full reset.
- **Reset extension** action in Settings. Wipes accounts, favorites, recents, prefs, layout, cached portal session, and AWS console cookies — back to a fresh-install state.
- **Auto-close after launch** *(optional, off by default)*. New Settings toggle — *Close panel after opening a service* — dismisses the side panel automatically the moment a console tab opens or refocuses. Applies to fresh launches, refocus from the Tabs / Favorites / Recents lists, and the open-in-other-account flow.
- **Per-tab close button** in the Tabs list. Each open-tab row has an inline ✕ button; the list updates instantly so closing feels immediate.

## [1.0.0] — 2026 initial release

- Side-panel UI for one-click access to AWS console — pick `account · role · region · service`, open the right URL.
- Fuzzy service search across the bundled AWS service catalog (services + common features).
- Multi-session aware: deep-links to `<account>-<session>.<region>.console.aws.amazon.com` when AWS multi-session console is enabled.
- Favorites: pin frequently-used `account · role · region · service` combos.
- Recents: recently-closed AWS console tabs remembered for one-click reopen.
- Account colors + region awareness mirroring the AWS console.
- Keyboard shortcut: `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Win/Linux).
- Daily catalog refresh from the public GitHub repo via jsDelivr CDN.
- Privacy: no telemetry, no remote logging, all state in `chrome.storage.sync` / `local` / `session`.

[1.0.3]: https://github.com/mceSystems/aws-shortcuts/releases/tag/v1.0.3
[1.0.2]: https://github.com/mceSystems/aws-shortcuts/releases/tag/v1.0.2
[1.0.1]: https://github.com/mceSystems/aws-shortcuts/releases/tag/v1.0.1
[1.0.0]: https://github.com/mceSystems/aws-shortcuts/releases/tag/v1.0.0
