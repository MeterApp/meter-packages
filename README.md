# Meter SDK and CLI

The MIT-licensed TypeScript SDK and command-line client for Meter. This repository is the source for both packages.

| Package | Install | Guide |
| --- | --- | --- |
| `@meterapp/meter-sdk` | `npm install @meterapp/meter-sdk` | [SDK](packages/meter-sdk/README.md) |
| `@meterapp/meter` | `npx @meterapp/meter --help` | [CLI](packages/meter-cli/README.md) |

Use Node 26 and the pnpm version in `package.json` for development:

```sh
pnpm install --frozen-lockfile
pnpm check
```

The checks build the packages, typecheck the source and run the tests. They do not need a live API or credentials.

Report potential vulnerabilities privately to hello@meterapp.co.
