# @meterapp/meter

Command-line client and MCP bridge for **Meter**, the taxi meter and fleet platform. Sign in once with OAuth, then read your fleets, members, vehicles, metered trips, bookings, Meter Pay earnings and accounting from a terminal, a CI job or an AI agent, submit feedback, vote on public ideas, follow updates and change settings after a `--dry-run` preview and human confirmation. Every command is a thin, typed wrapper over the same MCP tools the hosted servers at `https://www.meterapp.co/api/mcp/fleet` and `https://www.meterapp.co/api/mcp/rider` expose, so anything the server learns to do, the CLI can do without an update.

## Install

```bash
npx @meterapp/meter                  # no install
npm install -g @meterapp/meter       # or pnpm add -g / bun add -g
```

Node.js 20+. A global install keeps itself up to date (see [Updates](#updates)).

## 60-second quickstart

```bash
meter login                          # browser sign-in (OAuth 2.1 + PKCE); session stored with mode 0600
meter whoami                         # who you are, your fleets and roles
meter trips list --driver all --start-date 2026-09-01 --limit 25
meter bookings list --status pending,confirmed --sort asc
meter earnings --scope fleet --granularity week --include-members true --json
meter agent-config --host claude-code   # MCP setup for agents
```

## Commands

| Command | What it does |
| --- | --- |
| `login [--no-browser] [--client-id <id>] [--token <jwt>]` | OAuth 2.1 authorization-code + PKCE sign-in over a loopback redirect. Discovers the authorization server from `<origin>/.well-known/oauth-protected-resource`, registers the CLI dynamically (RFC 7591) or uses `--client-id`, opens the browser, exchanges the code and stores `access_token`, `refresh_token` and `expires_at` at `$XDG_CONFIG_HOME/meter/credentials.json` (default `~/.config/meter/`, mode `0600`), keyed by API origin. Sessions refresh automatically. `--token` stores an existing access token instead. |
| `logout` | Removes the stored session for the current origin. |
| `whoami` (alias `status`) | Profile, fleets with roles, where the token comes from and when it expires. |
| `doctor [--json]` | Checks Node, origin reachability, OAuth resource and authorization-server metadata, the MCP endpoint's `WWW-Authenticate` challenge, the stored session and a live `whoami`. Exit 1 on any failure, with fix hints. |
| `fleets list` · `fleets get [<fleet_id>]` | `list_fleets` / `get_fleet`. |
| `members list [--fleet-id] [--role owner\|admin\|driver]` | `list_fleet_members` (owners/admins). |
| `vehicles list [--fleet-id]` | `list_vehicles`. |
| `trips list [--driver me\|all\|<member_id>] [--start-date] [--end-date] [--cursor] [--limit]` · `trips get <trip_id>` | `list_trips` / `get_trip`. |
| `bookings list [--status …] [--after] [--before] [--sort asc\|desc] [--scope]` · `bookings get <id>` · `bookings audit <id>` | `list_bookings` / `get_booking` / `get_booking_audit_log`. |
| `earnings [--scope me\|fleet] [--start-date] [--end-date] [--granularity day\|week] [--include-members]` | `get_earnings` (Meter Pay payouts). |
| `accounting summary [--fleet-id] [--start-date] [--end-date] [--distance-unit mile\|kilometer]` | `get_accounting_summary` (owners/admins). |
| `ideas list\|search\|get\|vote` | Public ideas: list/search, read an idea by id, or preview/confirm a vote with `--voted true\|false`. Search takes `--title` and optional `--details`. |
| `feedback submit\|list\|get\|follow\|comment` | Submit an idea or private report, list authored/followed/fleet feedback, read a visible item, follow updates or add a comment. Writes use `--dry-run` then the same arguments plus `--proposal-id`. Submit/comment require an `--idempotency-key` UUID; preserve it on retries. |
| `changelog [list]` | Published release notes; use `--cursor` to continue. Full entries are limited to one per page. |
| `members list\|add\|invite-link\|rotate-code\|update\|rename\|remove\|online\|events\|docs\|review-doc` | Team: invite link and join code, add or remove drivers, roles and payout share, names, force online/offline, membership history, document status and approval. |
| `vehicles list\|add\|update\|remove\|assign` | Fleet vehicles and who drives which car. |
| `bookings create\|estimate\|assign\|unassign\|cancel\|remind\|calendar\|settings …` · `quotes list\|get\|create\|price\|send\|extend\|withdraw\|follow-up\|book` | Book rides for customers, quote and convert quotes, dispatch and booking policy. |
| `customers list\|get\|add\|update\|import` | Customer list; `import` takes rows or CSV text and previews creates, updates, duplicates and invalid rows. |
| `trips search [--sort] [--status] [--payment-method] [--min-total-minor] [--search]` | Sort and filter trips; fees, discounts, cash-paid, notes and voids under `trips`. |
| `accounting summary\|ledger\|balances\|driver\|settlements\|exceptions\|statements\|invoices\|taxes\|mileage` | Raw accounting rows for audits. |
| `export <dataset> [--from] [--to] [--driver] [--format csv\|json] [--out <file>\|-]` | Downloads trips, bookings, customers, members, vehicles, ledger, settlements, trip_invoices or quotes into one file, paging `export_data` to the end. |
| `fares …` · `zones list\|fares\|set-fares\|set-fare\|find\|save` · `promos list\|create\|update\|disable\|email` · `pricing dynamic\|set-dynamic\|fees\|finances` · `locations list\|add\|update\|remove` | Every fare feature: fares and ride options, official tariffs, zone-to-zone fares in bulk, promo codes, dynamic pricing, fees and payouts, airports and landmarks. |
| `storefront get\|set\|google-search\|google-link\|google-unlink\|pages\|privacy\|set-privacy\|voice-agent\|set-voice-agent` · `insights seo\|marketing\|drivers\|reviews\|metrics` | Booking site address, Google Maps listing, privacy, phone agent; Search Console, booking-site funnel and driver performance. |
| `settings fleet\|profile\|availability\|checklist\|webhooks` | Fleet name, contact phones, website, city, currency, timezone, colors; your profile and hours. |
| `billing status\|plans\|link <action>\|payments` · `links <action>` | Your plan, what every plan includes and costs, and the Meter page to upgrade, change, cancel, update the card or set up Meter Pay. Agents never pay or cancel; a person finishes in the browser. |
| `call <tool> [--<field> <value> …] [--args '<json>'] [--dry-run]` | Calls **any** tool by name. Flags are coerced from the tool's schema (numbers, booleans, enums, arrays as `a,b` or repeated flags, ISO dates). Tools this CLI build does not know yet are read from the server's `tools/list`, so new and write tools work immediately; `--dry-run` sets `dry_run: true` when the tool has that argument. |
| `describe [<tool>] [--json]` | The tool catalog, or one tool with arguments, roles, example call and result fields. Works offline. |
| `explain <tool> [<field>] [--json]` | Meaning, type, unit, enum values and role visibility of result fields (e.g. `meter explain list_trips total_minor`). |
| `mcp` | Runs a stdio MCP server that proxies `tools/list` and `tools/call` to the remote endpoint with your session (see below). |
| `agent-config --host claude-code\|claude-desktop\|codex\|chatgpt\|generic [--print] [--write] [--local]` | Ready-to-paste MCP configuration. `--write` merges the entry into `.mcp.json` (Claude Code). |
| `update [--check] [--no-plugins] [--json]` | Updates the CLI now, with the package manager that installed it, and the Meter plugins wherever Claude Code or Codex has them installed; `--check` only reports. See [Updates](#updates). |
| `help [command]` | Help. Every command also accepts `--help`; tool-shaped commands print the tool's arguments. |

Global options: `--json`, `--quiet`, `--api <origin>`, `--token <jwt>`, `--no-color`, `-h/--help`, `-v/--version`.

Output: the default is a readable table (pages) or key/value block (single objects) plus the server's "Next:" hint; `--json` prints the tool's structured result verbatim. Exit codes: `0` ok · `1` failure (including tool errors such as `not_found` or `forbidden`) · `2` usage error.

## Examples

```bash
meter fleets list
meter fleets get 11111111-1111-4111-8111-111111111111
meter members list --role driver
meter vehicles list --json
meter trips list --driver all --start-date 2026-09-01 --end-date 2026-09-30 --limit 100
meter trips get 22222222-2222-4222-8222-222222222222
meter bookings list --status pending --status confirmed --after 2026-09-11T00:00:00Z --sort asc
meter bookings get 33333333-3333-4333-8333-333333333333
meter bookings audit 33333333-3333-4333-8333-333333333333 --limit 20
meter earnings --scope me --start-date 2026-08-01 --end-date 2026-09-01
meter accounting summary --distance-unit kilometer
meter call get_earnings --args '{"scope":"fleet","include_members":true}' --json
meter describe list_bookings
meter explain get_booking pickup.address
```

Feedback writes use the same saved proposals as other agent changes. Generate a new payload UUID once, preview the complete text, then repeat the same arguments with the proposal id returned by the preview after approval:

```bash
feedback_key=$(uuidgen)
meter feedback submit --type idea --title 'Route reminders' --body 'Show a reminder before the pickup.' --category bookings --idempotency-key "$feedback_key" --dry-run --json
# After reviewing the preview, set proposal_id to its proposal.id.
meter feedback submit --type idea --title 'Route reminders' --body 'Show a reminder before the pickup.' --category bookings --idempotency-key "$feedback_key" --proposal-id "$proposal_id" --json
meter ideas list --sort top
meter feedback list --scope following
meter changelog
```

Use a new payload key for different text or context. For a private report, pass `--type issue`; an authorized context can be supplied through `--args` as `subject: {type, id}`. `meter feedback submit --help` lists accepted fields. Current visibility and role still govern every action. These commands require a server deployment containing the feedback tools.

## Agents (MCP)

The hosted server and the local bridge expose the same tools. Reads: `whoami`, `list_fleets`, `get_fleet`, `list_fleet_members`, `list_vehicles`, `list_trips`, `get_trip`, `list_bookings`, `get_booking`, `get_booking_audit_log`, `get_earnings`, `get_accounting_summary`, `get_onboarding_checklist`, `describe_api`, `explain_data`. Feedback reads and four proposal-backed writes are available through `ideas`, `feedback` and `changelog`. Settings writes, each with a `dry_run` preview: `update_fleet_settings`, `update_booking_settings`, `update_ride_option`, `assign_vehicle`, `update_my_profile`, `update_my_availability`. `meter describe` lists whatever the server you are signed in to currently offers.

- **Remote (recommended):** `https://www.meterapp.co/api/mcp/rider` (Meter Rides: booking and managing your rides) or `https://www.meterapp.co/api/mcp/fleet` (Meter for Drivers & Fleets: the driver app and the fleet console). Hosts that support remote MCP with OAuth (Claude Code, Claude Desktop/claude.ai connectors, Codex, ChatGPT) sign the human in through the browser; nothing to paste.
- **Local stdio:** `meter mcp` uses the session from `meter login` (or `METER_ACCESS_TOKEN`). Use it for hosts without OAuth support or in CI. `meter agent-config` writes it as `npx -y @meterapp/meter@latest mcp`: a bare package name lets npx reuse whatever copy it finds, an old global install included.

```bash
# Claude Code
claude mcp add --transport http meter-rides https://www.meterapp.co/api/mcp/rider
claude mcp add --transport http meter-fleet https://www.meterapp.co/api/mcp/fleet
meter agent-config --host claude-code --app fleet --write   # or a project-scoped .mcp.json

# Codex
codex mcp add meter-fleet --url https://www.meterapp.co/api/mcp/fleet && codex mcp login meter-fleet

# Claude Desktop, ChatGPT, generic
meter agent-config --host claude-desktop|chatgpt|generic

# Local bridge instead of OAuth in the host
meter login && meter agent-config --host claude-desktop --local
```

Every command takes `--app rider|fleet` (or `METER_APP`) to talk to one server; `meter rides …` uses Meter Rides on its own, and everything else uses Meter for Drivers & Fleets unless told otherwise. One `meter login` works for both.

The server's instructions tell agents to call `whoami` first, that ids are opaque, that money is in minor units, and that every settings change is previewed with `dry_run: true` and confirmed by the human before it is applied.

## CI and scripts

Set `METER_ACCESS_TOKEN` to skip the browser flow (it takes priority over the stored session) and `--json` to get machine-readable output:

```bash
METER_ACCESS_TOKEN=$TOKEN meter trips list --driver all --json | jq '.items | length'
```

## Environment

| Variable | Purpose |
| --- | --- |
| `METER_ACCESS_TOKEN` | Access token for this run (CI); overrides the stored session. |
| `METER_API_ORIGIN` | API origin, default `https://www.meterapp.co` (same as `--api`). Credentials are stored per origin. |
| `METER_OAUTH_CLIENT_ID` | OAuth client id when the authorization server has dynamic registration disabled (same as `--client-id`). |
| `METER_CONFIG_DIR` | Config directory, default `$XDG_CONFIG_HOME/meter` or `~/.config/meter` (`credentials.json`, `oauth-clients.json`, `update-check.json`). |
| `METER_NO_AUTO_UPDATE` | `1`: report a newer version, do not install it in the background. |
| `METER_NO_UPDATE_CHECK` | `1`: no update check at all (`NO_UPDATE_NOTIFIER=1` and `CI` too). `METER_NPM_REGISTRY` points the check at a mirror. |
| `NO_COLOR` / `FORCE_COLOR` | Color control. |

## Troubleshooting

- **`Not signed in.`** Run `meter login`, or set `METER_ACCESS_TOKEN`. Sessions are per origin: `--api` / `METER_API_ORIGIN` must match the one you signed in to.
- **`HTTP 401` after a while.** The refresh token was revoked or the session was pasted with `--token` (not refreshable). Run `meter login` again.
- **`does not offer dynamic client registration`.** Pass `--client-id <id>` (or `METER_OAUTH_CLIENT_ID`) for a public client registered with a `http://127.0.0.1` loopback redirect URI.
- **The browser did not open.** Copy the printed URL into a browser on the same machine (the redirect goes to `127.0.0.1`); `--no-browser` prints it without trying.
- **`forbidden` / permission errors.** Your fleet role does not allow the tool; `meter whoami` shows your roles. Drivers can use `--scope me` and `--driver me`.
- **`meter doctor`** runs every check above and prints a fix per failure.

## Updates

The CLI keeps itself current. At most once an hour a command starts a background check of npm (`update-check.json` in the config directory); when a newer version is out, the same background process installs it with the package manager that installed this copy (npm into the same global prefix, pnpm, bun, yarn or Volta) and the next command runs it. No command waits for the network or the install, agents and scripts see nothing on stdout or stderr, and `meter mcp` updates the same way for the next time the host starts it. At a terminal the CLI says once that it updated itself. The package manager's output is in `update.log` beside the cache; a failed install is retried after a day and mentioned at a terminal.

`METER_NO_AUTO_UPDATE=1` keeps the check and only says that a newer version exists; `METER_NO_UPDATE_CHECK=1`, `NO_UPDATE_NOTIFIER=1` or `CI` turn the check off. A copy the CLI cannot replace (an npx cache, a project dependency, a global directory your user cannot write) only gets a notice, with the command to run.

`meter update` does it now, in the foreground, and also refreshes the Meter plugins wherever Claude Code (`claude plugin marketplace update`, `claude plugin update`) or Codex (`codex plugin marketplace upgrade`) has them installed; `--no-plugins` skips that, `--check` only reports. Restart Claude Code (or run `/reload-plugins`) to load a new plugin; to have Claude Code keep it current on its own, turn on auto-update for its marketplace in `/plugin` → **Marketplaces**.

`npx @meterapp/meter` runs whatever copy npx finds first, a global install included; `npx @meterapp/meter@latest` always runs the newest release.

## Uninstall

```bash
npm uninstall -g @meterapp/meter     # or pnpm remove -g / bun remove -g
rm -rf ~/.config/meter               # stored session, cached OAuth client and update check
```

## License

MIT © Meter
