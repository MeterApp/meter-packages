import {
  MCP_SURFACES,
  MCP_TOOL_NAMES,
  type McpSurface
} from '@meterapp/meter-sdk/mcp';
import { mcpUrlFor } from './client.ts';
import { DEFAULT_API_ORIGIN, PACKAGE_NAME } from './version.ts';

export const AGENT_HOSTS = [
  'claude-code',
  'claude-desktop',
  'codex',
  'chatgpt',
  'generic'
] as const;
export type AgentHost = (typeof AGENT_HOSTS)[number];

/** Meter for Drivers & Fleets unless `--app rider` asks for Meter Rides. */
export const DEFAULT_APP: McpSurface = 'fleet';

/** The server's own name: `meter-rides` or `meter-fleet`. */
export function serverKeyFor(app: McpSurface = DEFAULT_APP): string {
  return MCP_SURFACES[app].serverInfo.name;
}

function serverTitle(app: McpSurface = DEFAULT_APP): string {
  return MCP_SURFACES[app].serverInfo.title;
}

export interface AgentConfigOptions {
  host: AgentHost;
  origin: string;
  /** Which MCP server to configure; defaults to Meter for Drivers & Fleets. */
  app?: McpSurface;
  /** Prefer the local stdio bridge (`meter mcp`) over the remote OAuth server. */
  local: boolean;
}

/** Remote Streamable HTTP entry; the host runs the OAuth flow itself. */
export function remoteServerConfig(
  origin: string,
  app: McpSurface = DEFAULT_APP
): Record<string, unknown> {
  return { type: 'http', url: mcpUrlFor(origin, app) };
}

/**
 * What a host runs for the stdio bridge. `@latest`, because a bare name lets
 * npx reuse whatever copy it finds (an old global install included) for as
 * long as the configuration lives.
 */
export const STDIO_PACKAGE_SPEC = `${PACKAGE_NAME}@latest`;

/** Stdio bridge entry: `npx -y @meterapp/meter@latest mcp`, authenticated by `meter login`. */
export function stdioServerConfig(
  origin: string,
  app: McpSurface = DEFAULT_APP
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    command: 'npx',
    args: ['-y', STDIO_PACKAGE_SPEC, 'mcp', '--app', app]
  };
  if (origin.replace(/\/+$/, '') !== DEFAULT_API_ORIGIN)
    entry['env'] = { METER_API_ORIGIN: origin };
  return entry;
}

export function serverConfigFor(
  options: AgentConfigOptions
): Record<string, unknown> {
  return options.local
    ? stdioServerConfig(options.origin, options.app)
    : remoteServerConfig(options.origin, options.app);
}

/** The `mcpServers` document written to .mcp.json / claude_desktop_config.json. */
export function mcpServersDocument(options: AgentConfigOptions): {
  mcpServers: Record<string, unknown>;
} {
  return {
    mcpServers: { [serverKeyFor(options.app)]: serverConfigFor(options) }
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toml(key: string, entry: Record<string, unknown>): string {
  const lines = [`[mcp_servers.${key}]`];
  for (const [field, value] of Object.entries(entry)) {
    if (field === 'type') continue;
    if (typeof value === 'string')
      lines.push(`${field} = ${JSON.stringify(value)}`);
    else if (Array.isArray(value))
      lines.push(
        `${field} = [${value.map((item) => JSON.stringify(item)).join(', ')}]`
      );
    else if (value && typeof value === 'object') {
      lines.push('', `[mcp_servers.${key}.${field}]`);
      for (const [innerKey, innerValue] of Object.entries(
        value as Record<string, unknown>
      ))
        lines.push(`${innerKey} = ${JSON.stringify(innerValue)}`);
    }
  }
  return lines.join('\n');
}

const LOCAL_NOTE =
  'The stdio bridge uses the session stored by `meter login` (or METER_ACCESS_TOKEN); tokens never appear in config files.';
const REMOTE_NOTE =
  "The host signs in through Meter's OAuth flow in your browser; nothing to paste. Prefer this over the stdio bridge whenever the host supports remote MCP servers.";

export function renderAgentConfig(options: AgentConfigOptions): string {
  const url = mcpUrlFor(options.origin, options.app);
  const key = serverKeyFor(options.app);
  const appArg = ` --app ${options.app ?? DEFAULT_APP}`;
  const document = mcpServersDocument(options);
  const note = options.local ? LOCAL_NOTE : REMOTE_NOTE;
  const envArg =
    options.origin.replace(/\/+$/, '') === DEFAULT_API_ORIGIN
      ? ''
      : ` --env METER_API_ORIGIN=${options.origin}`;
  switch (options.host) {
    case 'claude-code':
      return [
        '# Claude Code',
        '',
        options.local
          ? `# Local stdio bridge (after \`meter login\`):\nclaude mcp add ${key}${envArg} -- npx -y ${STDIO_PACKAGE_SPEC} mcp${appArg}`
          : `# Remote MCP server with OAuth (recommended):\nclaude mcp add --transport http ${key} ${url}`,
        '',
        '# Project-scoped alternative: .mcp.json in the repository root (`meter agent-config --host claude-code --write`)',
        json(document),
        '',
        `# ${note}`
      ].join('\n');
    case 'claude-desktop':
      return options.local
        ? [
            '# Claude Desktop — local stdio bridge',
            '# Add to claude_desktop_config.json (Settings → Developer → Edit Config):',
            '#   macOS: ~/Library/Application Support/Claude/claude_desktop_config.json',
            '#   Windows: %APPDATA%\\Claude\\claude_desktop_config.json',
            json(document),
            '',
            `# ${note}`
          ].join('\n')
        : [
            '# Claude Desktop (and claude.ai)',
            '# Settings → Connectors → Add custom connector →',
            `#   Name: ${serverTitle(options.app)}`,
            `#   Remote MCP server URL: ${url}`,
            '#   Leave OAuth client id/secret empty; Claude registers itself and opens the Meter sign-in page.',
            '',
            `# ${note}`
          ].join('\n');
    case 'codex':
      return [
        '# Codex CLI',
        '',
        options.local
          ? `codex mcp add ${key} -- npx -y ${STDIO_PACKAGE_SPEC} mcp${appArg}`
          : `codex mcp add ${key} --url ${url}\ncodex mcp login ${key}`,
        '',
        '# Equivalent ~/.codex/config.toml entry:',
        toml(key, serverConfigFor(options)),
        '',
        `# ${note}`
      ].join('\n');
    case 'chatgpt':
      return [
        '# ChatGPT',
        '',
        '# Connector (developer mode / Apps): Settings → Connectors → Create →',
        `#   Name: ${serverTitle(options.app)}`,
        `#   MCP server URL: ${url}`,
        '#   Authentication: OAuth (leave client credentials empty; ChatGPT registers itself and opens the Meter sign-in page)',
        '#   Then start a chat, enable the Meter connector, and ask about your fleet.',
        '',
        '# ChatGPT cannot run local stdio servers; the remote server above is the only option.'
      ].join('\n');
    default:
      return [
        '# Generic MCP client configuration',
        '',
        '# Remote Streamable HTTP with OAuth 2.1 (resource metadata at <origin>/.well-known/oauth-protected-resource):',
        json(remoteServerConfig(options.origin)),
        '',
        '# Local stdio bridge (after `meter login`):',
        json(stdioServerConfig(options.origin)),
        '',
        `# Tools: ${MCP_TOOL_NAMES.join(', ')}`,
        `# ${REMOTE_NOTE}`
      ].join('\n');
  }
}

/** Where `--write` puts the project-scoped config for hosts that read a JSON file. */
export function configFilePathFor(host: AgentHost, cwd: string): string | null {
  switch (host) {
    case 'claude-code':
      return `${cwd}/.mcp.json`;
    default:
      return null;
  }
}
