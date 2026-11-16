import { MeterMcpClient } from '@meterapp/meter-sdk/client';
import {
  isMcpSurface,
  MCP_SURFACES,
  type McpSurface
} from '@meterapp/meter-sdk/mcp';
import { flagString, type FlagValue } from './args.ts';
import {
  credentialsPath,
  getCredential,
  normalizeOrigin,
  saveCredential,
  type StoredCredential
} from './config.ts';
import { CliError } from './errors.ts';
import type { FetchLike } from './oauth/discovery.ts';
import { canRefresh, needsRefresh, refreshCredential } from './oauth/login.ts';
import type { Env } from './output.ts';
import { CLI_VERSION, DEFAULT_API_ORIGIN } from './version.ts';

export type TokenSource = 'flag' | 'env' | 'stored' | null;

export interface ClientContext {
  origin: string;
  /** Which MCP server: Meter Rides or Meter for Drivers & Fleets. */
  app: McpSurface;
  mcpUrl: string;
  credentialsPath: string;
  fetch: FetchLike;
  userAgent: string;
  /** Resolves the access token, refreshing a stored session when it is about to expire. */
  token(): Promise<{ accessToken: string; source: TokenSource } | null>;
  /** Access token or a CliError asking to sign in. */
  requireToken(): Promise<string>;
  /** An MCP client bound to the current token (initialized lazily by callers). */
  client(): Promise<MeterMcpClient>;
}

/** Identifies the package version and runtime; the stdio bridge uses `meter-mcp`. */
export function userAgent(kind: 'cli' | 'mcp' = 'cli'): string {
  return `meter-${kind}/${CLI_VERSION} (${process.platform}; node/${process.version})`;
}

/** `--api` > `METER_API_ORIGIN` > default. */
export function resolveOrigin(
  flags: Record<string, FlagValue>,
  env: Env
): string {
  const raw =
    flagString(flags, 'api') ??
    env['METER_API_ORIGIN']?.trim() ??
    DEFAULT_API_ORIGIN;
  try {
    return normalizeOrigin(raw);
  } catch (error) {
    throw new CliError(
      error instanceof Error ? error.message : String(error),
      2
    );
  }
}

/** `--app` > `METER_APP` > the command's own server > Meter for Drivers & Fleets. */
export function resolveApp(
  flags: Record<string, FlagValue>,
  env: Env,
  fallback: McpSurface = 'fleet'
): McpSurface {
  const raw = (flagString(flags, 'app') ?? env['METER_APP'])?.trim();
  if (!raw) return fallback;
  if (isMcpSurface(raw)) return raw;
  throw new CliError(
    `Unknown app "${raw}".`,
    2,
    'Pass --app rider (Meter Rides) or --app fleet (Meter for Drivers & Fleets, the default).'
  );
}

export function mcpUrlFor(origin: string, app: McpSurface = 'fleet'): string {
  return `${origin.replace(/\/+$/, '')}${MCP_SURFACES[app].path}`;
}

export function createClientContext(
  flags: Record<string, FlagValue>,
  env: Env,
  options: {
    kind?: 'cli' | 'mcp';
    fetch?: FetchLike;
    now?: () => number;
    /** The command's own server when neither `--app` nor `METER_APP` is set. */
    app?: McpSurface;
  } = {}
): ClientContext {
  const origin = resolveOrigin(flags, env);
  const app = resolveApp(flags, env, options.app);
  const fetchImpl: FetchLike =
    options.fetch ?? ((input, init) => fetch(input, init));
  const agent = userAgent(options.kind ?? 'cli');
  const path = credentialsPath(env);
  const now = options.now ?? (() => Date.now());
  let cached: { accessToken: string; source: TokenSource } | null | undefined;

  const token = async () => {
    if (cached !== undefined) return cached;
    const fromFlag = flagString(flags, 'token')?.trim();
    if (fromFlag) return (cached = { accessToken: fromFlag, source: 'flag' });
    const fromEnv = env['METER_ACCESS_TOKEN']?.trim();
    if (fromEnv) return (cached = { accessToken: fromEnv, source: 'env' });
    let stored: StoredCredential | null = await getCredential(path, origin);
    if (!stored) return (cached = null);
    if (needsRefresh(stored, now()) && canRefresh(stored)) {
      const refreshed = await refreshCredential(fetchImpl, stored, now());
      stored = await saveCredential(path, origin, refreshed);
    }
    return (cached = { accessToken: stored.access_token, source: 'stored' });
  };

  return {
    origin,
    app,
    mcpUrl: mcpUrlFor(origin, app),
    credentialsPath: path,
    fetch: fetchImpl,
    userAgent: agent,
    token,
    async requireToken() {
      const resolved = await token();
      if (!resolved) {
        throw new CliError(
          'Not signed in.',
          1,
          `Run \`meter login\` (or set METER_ACCESS_TOKEN) for ${origin}.`
        );
      }
      return resolved.accessToken;
    },
    async client() {
      const accessToken = await this.requireToken();
      return new MeterMcpClient({
        url: mcpUrlFor(origin, app),
        accessToken,
        fetch: (input, init) =>
          fetchImpl(input, {
            ...init,
            headers: {
              ...(init?.headers as Record<string, string> | undefined),
              'User-Agent': agent
            }
          }),
        clientInfo: {
          name: options.kind === 'mcp' ? 'meter-mcp' : 'meter-cli',
          version: CLI_VERSION
        }
      });
    }
  };
}
