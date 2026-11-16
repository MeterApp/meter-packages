# @meterapp/meter-sdk

Shared contracts for Meter's public AI surface:

- `@meterapp/meter-sdk/mcp` — the MCP tool catalog (`MCP_TOOLS`, `MCP_TOOL_SCHEMAS`, `MCP_INSTRUCTIONS`, `MCP_SERVER_INFO`) plus tool-result helpers. Every Meter MCP server registers exactly these tools.
- `@meterapp/meter-sdk/dto` — zod schemas and TypeScript types for every public object (fleet, member, vehicle, trip, booking, audit entry, earnings, accounting, profile). They are allowlists: servers build objects field by field and `parse()` them, so an unexpected key fails instead of leaking.
- `@meterapp/meter-sdk/docs` — field documentation generated from the schemas' `.meta()` (meaning, unit, enum values, role visibility). Served by the `explain_data` tool.
- `@meterapp/meter-sdk/client` — a tiny fetch-based MCP JSON-RPC client (`initialize`, `tools/list`, `tools/call`) with a bearer token.

Runtime dependency: `zod` v4 only.

## Source layout rules

- Relative imports inside `src/` use explicit `.ts` extensions (`import { x } from './tools.ts'`). Turbopack, Vite/vitest and the backend `tsc` (which has `allowImportingTsExtensions`) resolve them as-is, and `tsc -p tsconfig.build.json` rewrites them to `.js` in `dist/` via `rewriteRelativeImportExtensions`. Do not use `.js` specifiers: Turbopack cannot map them back to `.ts` sources and `next build` fails.
- TypeScript does not rewrite specifiers in declaration output, so `scripts/postbuild.mjs` (run by `pnpm build`) rewrites `.ts` to `.js` in `dist/**/*.d.ts`.
- Use only erasable TypeScript syntax (no enums, namespaces or constructor parameter properties): the CLI in `packages/meter-cli` resolves this package to `src/` inside the monorepo and Node's built-in type stripping must be able to load it.

## Adding a tool

1. Add its input schema to `MCP_TOOL_SCHEMAS` and its definition to `MCP_TOOLS` in `src/mcp/tools.ts` (description of at least 120 characters that says when to use it, when not to, which roles may call it and what it returns).
2. If it returns a new object, add a strict DTO in `src/dto/*.ts` with `field(...)` docs and register it in `DTO_SCHEMAS`.
3. Implement the executor in `backend/server/mcp/tools/` and add it to `createToolExecutors`. The type checker fails until every catalog tool has an executor.
