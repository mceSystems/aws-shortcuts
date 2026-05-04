# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security-related bugs.**

If you believe you have found a security or privacy vulnerability in AWS Shortcut, send a private report to:

- **Email:** [netanel.d@mce-sys.com](mailto:netanel.d@mce-sys.com)
- **Subject:** `[aws-shortcut] <short summary>`

If you don't get an acknowledgement within 5 business days, please open a GitHub issue titled "Security report — please respond" without disclosing the details, and we will reach out privately.

## Scope

In scope:

- Anything in the published extension (manifest, side panel, service worker, content script).
- Anything in [`scripts/`](scripts/) that runs as part of the catalog update process.
- Privacy regressions (data leaving the device, identifying information sent to third parties, the bearer token escaping the extension's storage).

Out of scope:

- Vulnerabilities in AWS services themselves — report those to AWS directly: <https://aws.amazon.com/security/vulnerability-reporting/>.
- Vulnerabilities in third-party dependencies that are already publicly disclosed and tracked by their maintainers — feel free to mention them in a regular issue or PR.
- Social-engineering scenarios that require an attacker to already have arbitrary local code execution on the user's machine.

## What to include

A useful report has at least:

- A clear description of the issue and its impact.
- The extension version (from `chrome://extensions`) where you observed it.
- Steps to reproduce, or a proof-of-concept.
- Your assessment of severity.

Reports written in plain English are fine — please don't gate disclosure on having a polished writeup.

## Disclosure

We will:

1. Acknowledge receipt within 5 business days.
2. Investigate and confirm or deny the issue, and let you know either way.
3. Develop a fix, prepare a release, and submit it to the Chrome Web Store.
4. Coordinate a public disclosure date with you. We aim for **30 days** from confirmed report to public disclosure unless the issue is actively being exploited.

We will credit reporters in the release notes unless they ask not to be named.

## Past advisories

None yet.
