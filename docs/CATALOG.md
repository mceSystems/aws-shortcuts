# Service Catalog

This extension's service search reads from `catalog/services.json`, a
versioned list of AWS services + features. Two paths to update it:

1. **Manual edit** — open the file, add/edit entries, bump `version`, commit.
   Easiest for one-off fixes.
2. **Harvest from console** — scrape the live AWS console DOM via the
   extension's dev-only Settings panel, merge into the catalog. Best for
   keeping up with new AWS services / nav changes.

Either path produces the same `catalog/services.json` output. Choose
whichever fits the change.

## Schema

```jsonc
{
  "schemaVersion": 2,
  "version": "2026.04.30",        // bumped on each commit; users pull when newer
  "services": [
    {
      "id": "ec2",                // stable lookup key (lowercase, alphanumeric)
      "name": "EC2",              // display name
      "consolePath": "ec2/home",  // appended to https://<region>.console.aws.amazon.com/
      "aliases": ["Elastic Compute Cloud", "compute"],   // search synonyms
      "features": [
        { "name": "Instances", "path": "ec2/home#Instances:" }
      ]
    }
  ]
}
```

The popup pulls this JSON from `cdn.jsdelivr.net/gh/<owner>/<repo>@main/catalog/services.json`
on a 24h alarm + on install. Bundled snapshot ships in the extension as a
fallback for the first run / offline.

## Path 1 — manual

Edit `catalog/services.json`, bump `version`, commit, push. Done. Users see
the change within 24h (or after a manual "Refresh now" in Settings).

## Path 2 — harvest from console

### One-time setup

```sh
npm install
npm run dev          # development build, leaves harvest UI exposed
```

Load the unpacked extension from `dist/` into Chrome.

### Run the harvest

1. Right-click the extension icon → **Options** (or open
   `chrome://extensions/?options=<id>`).
2. Scroll to **Catalog Harvest** (only visible in dev builds).
3. Click **Harvest services** — a hidden tab opens at
   `console.aws.amazon.com/console/home`. The harvester clicks the global
   "Services" mega-menu and scrapes every link. Takes a few seconds.
4. (Optional) Click **Harvest features** — for each harvested service the
   extension navigates to its home page and scrapes the left rail. Slower
   (~7 minutes for 200 services). Sub-pages with no left rail are skipped.
5. Click **Download JSON** — saves `harvested.raw.json` to your Downloads
   folder.

### Merge into the catalog

```sh
mv ~/Downloads/harvested.raw.json catalog/
npm run catalog:merge -- --dry    # preview diff
npm run catalog:merge             # apply
git diff catalog/services.json    # review
git add catalog/services.json
git commit -m "catalog: refresh from harvest"
git push
```

The merge tool:

- Wins from `harvested.raw.json` for `name`, `consolePath`, `features`.
- Adds `aliases` from `catalog/overrides.json` (harvested data never has
  synonyms — those live manually).
- Applies `consolePathOverrides` and `nameOverrides` from
  `catalog/overrides.json` last (manual fixes for services where the
  harvester picks a wrong path).
- Drops anything in `overrides.json:exclude`.
- Bumps `version` to today's date (UTC, `YYYY.MM.DD`).

### Flags

```
npm run catalog:merge -- --dry       # show diff, no write
npm run catalog:merge -- --strict    # drop services not in harvest output
                                     # (default: keep them, useful when your
                                     #  AWS account has fewer services
                                     #  enabled than a "rich" maintainer
                                     #  account)
```

## `catalog/overrides.json`

```jsonc
{
  "aliases": {
    "ec2": ["Elastic Compute Cloud", "compute", "vm"]
  },
  "consolePathOverrides": {
    "billing": "billing/home"      // force a path the harvester misses
  },
  "nameOverrides": {
    "sso": "IAM Identity Center"   // force display name
  },
  "exclude": ["service-id-to-drop"]
}
```

This file is the source of truth for everything **not** in the AWS console
DOM. Edit freely; the merge tool re-applies on every run.

## Forks

Public fork? Repoint the catalog URL:

1. Edit `src/background/catalogRefresh.ts` — change `REPO`/`BRANCH` to your
   fork.
2. Edit `src/manifest.ts` if you change CDN host.
3. Run the harvest flow above with your own AWS account so your catalog
   reflects the services you care about.

Forks make sense when:

- Your team has services unavailable in the public AWS commercial console
  (GovCloud, internal regions).
- You want different feature curation (deeper sub-pages for your team's
  most-used services).
- You don't want the daily auto-refresh from upstream.

## Troubleshooting

**"Services menu trigger not found"** — AWS shipped a Cloudscape redesign.
Open `src/background/harvester.ts` and add a new selector to
`triggerSelectors`. The harvester tries each in order.

**Service has no consolePath after harvest** — the anchor in the menu was
empty (rare). Add a manual entry to `consolePathOverrides`.

**Features missing for a specific service** — that service has a non-standard
left rail. Either curate manually in `catalog/services.json` (won't be
overwritten if the harvester returns nothing for that id) or add a special
case in `scrapeFeaturesInTab()`.

**Catalog stale on users' devices** — they can hit "Refresh now" in
Settings, or just wait up to 24h for the alarm. New extension installs
always fetch immediately.
