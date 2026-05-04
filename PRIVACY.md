# Privacy Policy

**AWS Shortcut Chrome Extension**
Last updated: 2026-05-04

## Summary

AWS Shortcut runs entirely on your local device. **No data is collected, transmitted, or sold to any third party.** No analytics. No telemetry. No remote logging. No advertising. No accounts. The extension operates as a local productivity tool that interacts only with AWS endpoints you already access through your browser.

## Data the extension reads

To do its job, the extension reads the following data while it runs in your browser:

| Data | Where it comes from | Why |
|---|---|---|
| Your IAM Identity Center (AWS SSO) bearer token | The `Authorization: Bearer …` header on outgoing requests to `portal.sso.<region>.amazonaws.com` | Required to call the AWS portal API and list the accounts/roles you have access to. |
| List of AWS accounts and roles assigned to you | AWS portal API response | Populates the account picker in the side panel. |
| AWS console session cookies (presence + expiry only — never the values) | `chrome.cookies.getAll` for AWS console subdomains | Detects whether a multi-session console tab is live so we can launch the direct console URL instead of routing through the federation redirect. |
| URL, title, observed account/role/region/color of your open AWS console tabs | A content script on `*.console.aws.amazon.com` | Keeps the side panel in sync with what you have open and detects which AWS account each tab belongs to. |
| The IAM Identity Center start URL you pasted during onboarding | You enter it manually | Required to know which portal to call. |

The extension never reads or stores: passwords, MFA codes, AWS access keys, AWS secret keys, the contents of session cookies, the contents of any AWS console page beyond the account/role/region/color labels visible in the chrome of the page, or anything from non-AWS websites.

## Where data is stored

All data stays on your device, in Chrome's extension storage areas:

- **`chrome.storage.sync`** — AWS portal config, list of accounts, your role/region preferences, favorites, layout preferences. Sync is provided by Chrome itself; if you are signed into Chrome with sync enabled, Google syncs this storage area across your Chrome profile, encrypted in transit. The extension does not control or see Chrome sync.
- **`chrome.storage.local`** — recently-closed AWS console tab list and the cached service catalog snapshot. Never leaves your device.
- **`chrome.storage.session`** — bearer token and per-account multi-session subdomain mapping. Cleared when Chrome closes.

## Data we send out of your browser

| Destination | Purpose | What is sent |
|---|---|---|
| `portal.sso.<region>.amazonaws.com` | AWS portal API — list accounts, list roles, mint federation credentials | Standard AWS portal API requests, authenticated with **your** IAM Identity Center bearer token (the same one your browser already sends when you visit the portal). |
| `*.signin.aws.amazon.com`, `*.console.aws.amazon.com` | Open the AWS console tab | A standard navigation request your browser would make if you clicked an AWS link. |
| `cdn.jsdelivr.net`, `raw.githubusercontent.com` | Refresh the bundled service catalog (`catalog/services.json`) once every 24 hours | A simple HTTPS GET for a public JSON file. No identifying information is sent beyond the standard HTTP request. |

The extension does **not** talk to any servers operated by the extension authors. There is no backend.

## Permissions and why we ask for them

| Permission | Why |
|---|---|
| `cookies` | Probe AWS console subdomains for presence of a live session cookie (presence + expiry only — never the cookie value). |
| `webRequest` | Read the `Authorization: Bearer` header on portal requests so the extension can authenticate to the AWS portal API on your behalf. The token never leaves your device. |
| `declarativeNetRequest`, `declarativeNetRequestWithHostAccess` | Rewrite the `Origin`/`Referer` headers on extension-initiated requests to the AWS portal API. The portal API rejects `chrome-extension://` origins; without this rule, the API will not respond. |
| `tabs`, `scripting` | Discover open AWS console tabs and inject the content script that observes account/role/region/color for the side panel. |
| `sidePanel` | The primary UI surface — the side panel itself. |
| `storage`, `notifications`, `alarms` | Persist accounts/favorites/preferences; schedule the daily catalog refresh; surface a non-blocking notification when an account scan completes. |
| Host access to `*.awsapps.com`, `portal.sso.*.amazonaws.com`, `*.console.aws.amazon.com`, `*.signin.aws.amazon.com` | The AWS endpoints the extension needs to read from. |
| Host access to `cdn.jsdelivr.net`, `raw.githubusercontent.com` | Service catalog refresh from the extension's public GitHub repo via a CDN. |

## Third-party services

- **jsDelivr** (`cdn.jsdelivr.net`) and **GitHub** (`raw.githubusercontent.com`) serve the service catalog JSON. These are public CDNs; no identifying request body is sent. You can review the URLs and source data in the extension's repository.
- **Amazon Web Services** — every AWS interaction goes through endpoints you already use when accessing the AWS console directly. AWS's privacy policy applies to those interactions: <https://aws.amazon.com/privacy/>.

## Children

This extension is not directed to children under 13.

## Open source

The extension is open source. You can audit every line of code that handles your data here:

<https://github.com/mceSystems/aws-shortcuts>

If anything in this policy is unclear or inconsistent with what the code actually does, the code is the authoritative answer — please open an issue.

## Contact

For privacy questions or security disclosures, open an issue at <https://github.com/mceSystems/aws-shortcuts/issues> or email the maintainers (see [SECURITY.md](SECURITY.md) for the security disclosure process).

## Changes to this policy

If we change this policy, we will update the "Last updated" date at the top of this document. Material changes will also be noted in the project's `CHANGELOG.md` and tied to a release.
