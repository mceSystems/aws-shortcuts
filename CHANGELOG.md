# Changelog

All notable changes to AWS Shortcut are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

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

[1.0.1]: https://github.com/mceSystems/aws-shortcuts/releases/tag/v1.0.1
[1.0.0]: https://github.com/mceSystems/aws-shortcuts/releases/tag/v1.0.0
