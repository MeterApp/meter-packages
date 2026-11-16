import { MCP_TOOL_NAMES } from '@meterapp/meter-sdk/mcp';
import type { CommandContext, CommandDefinition } from '../context.ts';
import {
  BIN_NAME,
  CLI_VERSION,
  DEFAULT_API_ORIGIN,
  PACKAGE_NAME
} from '../version.ts';

export interface HelpEntry {
  name: string;
  summary: string;
  usage: string;
}

export const GLOBAL_OPTIONS_TEXT = `Global options:
  --json               machine-readable output on stdout
  --quiet, -q          only errors and essential output
  --api <origin>       API origin (default ${DEFAULT_API_ORIGIN}; env METER_API_ORIGIN)
  --app rider|fleet    Meter Rides or Meter for Drivers & Fleets only (env METER_APP; default both)
  --token <jwt>        access token for this run (env METER_ACCESS_TOKEN)
  --no-color           disable colors (env NO_COLOR)
  -h, --help           show help (also \`${BIN_NAME} <command> --help\`)
  -v, --version        print the version`;

export function helpText(
  entries: HelpEntry[],
  command?: string | null
): string {
  if (command) {
    const entry = entries.find(
      (candidate) =>
        candidate.name === command || candidate.name.startsWith(`${command} `)
    );
    if (entry) {
      return `${BIN_NAME} ${entry.name} — ${entry.summary}\n\nUsage:\n  ${entry.usage.split('\n').join('\n  ')}\n\n${GLOBAL_OPTIONS_TEXT}\n`;
    }
  }
  const width = Math.max(...entries.map((entry) => entry.name.length));
  const commands = entries
    .map((entry) => `  ${entry.name.padEnd(width)}  ${entry.summary}`)
    .join('\n');
  return `${BIN_NAME} ${CLI_VERSION} — Meter CLI (${PACKAGE_NAME})
Run your fleet from a terminal or an agent: members, vehicles, fares, zones, promos, bookings, quotes, customers, accounting, exports, booking site, SEO and billing. Preview changes before confirming.

Usage:
  ${BIN_NAME} <command> [options]

Commands:
${commands}

${GLOBAL_OPTIONS_TEXT}

Environment:
  METER_ACCESS_TOKEN    access token (CI); takes priority over the stored session
  METER_API_ORIGIN      API origin (default ${DEFAULT_API_ORIGIN})
  METER_OAUTH_CLIENT_ID OAuth client id when dynamic registration is disabled
  METER_CONFIG_DIR      config directory (default $XDG_CONFIG_HOME/meter or ~/.config/meter)
  METER_NO_AUTO_UPDATE  1: report a newer CLI, do not install it in the background
  METER_NO_UPDATE_CHECK 1: no update check at all (CI and NO_UPDATE_NOTIFIER=1 too)

Tools (\`${BIN_NAME} call <tool> --<field> <value>\`):
  ${MCP_TOOL_NAMES.join(', ')}

Examples:
  ${BIN_NAME} login
  ${BIN_NAME} whoami
  ${BIN_NAME} trips list --driver all --start-date 2026-09-01 --limit 25
  ${BIN_NAME} bookings list --status pending,confirmed --sort asc
  ${BIN_NAME} call get_earnings --scope fleet --granularity week --include-members true --json
  ${BIN_NAME} export trips --from 2026-09-01 --to 2026-10-01 --out september.csv
  ${BIN_NAME} accounting ledger --start-date 2026-09-01 --json
  ${BIN_NAME} members invite-link
  ${BIN_NAME} members remove <member_id> --dry-run
  ${BIN_NAME} billing status · ${BIN_NAME} billing plans · ${BIN_NAME} billing link cancel_subscription
  ${BIN_NAME} promos create --code SUMMER10 --discount-type percentage --discount-percentage 10 --dry-run
  ${BIN_NAME} insights seo
  ${BIN_NAME} ideas list --sort top
  ${BIN_NAME} feedback list --scope following
  ${BIN_NAME} changelog
  ${BIN_NAME} agent-config --host claude-code

Exit codes: 0 ok, 1 failure, 2 usage error. Docs: ${DEFAULT_API_ORIGIN}/docs/mcp
`;
}

export function helpCommand(entries: () => HelpEntry[]): CommandDefinition {
  return {
    name: 'help',
    summary: 'Show help for all commands or one command',
    usage: 'meter help [command]',
    async run(ctx: CommandContext): Promise<number> {
      ctx.io.stdout(helpText(entries(), ctx.args.positionals[0] ?? null));
      return 0;
    }
  };
}
