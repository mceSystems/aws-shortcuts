# vendor/

Local-only source artifacts. Gitignored.

## aws-icons-source/

Two ways to populate.

### Option A — fetch from GitHub (one command)

```sh
npm run icons:fetch
```

Pulls awslabs/aws-icons-for-plantuml v18.0 tarball (~50MB), caches at
`.cache/aws-icons-<ver>.tar.gz`, extracts `dist/` here. Override version:

```sh
npm run icons:fetch -- 18.0
ICONS_VERSION=18.0 npm run icons:fetch
```

### Option B — drop files manually

Useful for AWS official Architecture Icons ZIP or any other source.

1. Download AWS Architecture Icons ZIP from
   https://aws.amazon.com/architecture/icons/
2. Extract anywhere into `vendor/aws-icons-source/`. The build script
   searches by filename so subdirectory structure does not matter.

### Then build

```sh
npm run icons:build
```

Outputs land in `src/assets/icons/{id}.{svg,png}` and are committed. Fresh
clones can build the extension without the vendor archive — vendor is only
needed when adding/replacing icons.

Filename mapping lives in [scripts/icon-map.json](../scripts/icon-map.json).
Add an entry there for each new service id in `src/data/services.json`. Run
`npm run icons:build` again to regenerate.

CI runs `npm run icons:check` to ensure committed outputs match the current
map + lockfile.
