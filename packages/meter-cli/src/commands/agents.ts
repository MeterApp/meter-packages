import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  AGENT_HOSTS,
  configFilePathFor,
  mcpServersDocument,
  renderAgentConfig,
  serverKeyFor,
  type AgentHost
} from '../agent-config.ts';
import { flagChoice, flagString } from '../args.ts';
import { createClientContext } from '../client.ts';
import type { CommandContext, CommandDefinition } from '../context.ts';
import { CliError } from '../errors.ts';
import { createBridge, serveStdio } from '../mcp/bridge.ts';
import { ok, printJson } from '../output.ts';

/** Merges the Meter entry into an existing `mcpServers` JSON file (created when missing). */
export async function writeMcpServersFile(
  path: string,
  entry: Record<string, unknown>,
  key: string = serverKeyFor()
): Promise<{ created: boolean }> {
  let existing: Record<string, unknown> = {};
  let created = true;
  try {
    const raw = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new CliError(
        `${path} is not a JSON object; refusing to rewrite it.`,
        1,
        'Use --print and merge the Meter entry by hand.'
      );
    }
    existing = parsed as Record<string, unknown>;
    created = false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new CliError(
        `Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`,
        1,
        'Fix or remove the file, or use --print and merge by hand.'
      );
    }
  }
  const current = existing['mcpServers'];
  if (
    current !== undefined &&
    (!current || typeof current !== 'object' || Array.isArray(current))
  ) {
    throw new CliError(
      `${path} has an "mcpServers" value that is not an object; refusing to rewrite it.`,
      1,
      'Use --print and merge the Meter entry by hand.'
    );
  }
  const servers = (current as Record<string, unknown> | undefined) ?? {};
  const next = { ...existing, mcpServers: { ...servers, [key]: entry } };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return { created };
}

export const agentConfigCommand: CommandDefinition = {
  name: 'agent-config',
  summary:
    'Print (or write) MCP configuration for Claude Code, Claude Desktop, Codex, ChatGPT or any client',
  usage:
    'meter agent-config --host claude-code|claude-desktop|codex|chatgpt|generic [--app rider|fleet] [--print] [--write] [--local] [--out <file>] [--json]\n  --print   print the snippet (default)\n  --write   merge the entry into the project config file (.mcp.json for claude-code, or --out <file>)\n  --local   configure the stdio bridge (`meter mcp`) instead of the remote OAuth server',
  async run(ctx: CommandContext): Promise<number> {
    const host: AgentHost =
      flagChoice(ctx.args.flags, 'host', AGENT_HOSTS) ?? 'generic';
    const local = ctx.args.flags['local'] === true;
    const options = {
      host,
      origin: ctx.clientContext.origin,
      app: ctx.clientContext.app,
      local
    };
    const key = serverKeyFor(options.app);
    const document = mcpServersDocument(options);
    const out = flagString(ctx.args.flags, 'out');
    if (ctx.args.flags['write'] === true || out) {
      const path = out ?? configFilePathFor(host, ctx.cwd);
      if (!path)
        throw new CliError(
          `--write is not supported for ${host}; it has no project config file.`,
          2,
          'Use --print and follow the instructions, or pass --out <file>.'
        );
      const { created } = await writeMcpServersFile(
        path,
        document.mcpServers[key] as Record<string, unknown>,
        key
      );
      if (ctx.io.json)
        printJson(ctx.io, { ok: true, path, created, ...document });
      else
        ctx.io.stdout(
          `${ok(ctx.io, `${created ? 'Created' : 'Updated'} ${path} with the "${key}" MCP server.`)}\n`
        );
      return 0;
    }
    if (ctx.io.json) {
      printJson(ctx.io, document);
      return 0;
    }
    ctx.io.stdout(`${renderAgentConfig(options)}\n`);
    return 0;
  }
};

export const mcpCommand: CommandDefinition = {
  name: 'mcp',
  summary:
    'Run a stdio MCP server that proxies to the remote Meter MCP endpoint with your session',
  usage:
    'meter mcp [--api <origin>] [--app rider|fleet]\n  Uses the session from `meter login` or METER_ACCESS_TOKEN. Configure hosts with `meter agent-config --local`.',
  async run(ctx: CommandContext): Promise<number> {
    // A dedicated client so the server can attribute traffic to the bridge.
    const mcpContext = createClientContext(ctx.args.flags, ctx.env, {
      kind: 'mcp',
      fetch: ctx.clientContext.fetch,
      now: () => ctx.now()
    });
    const token = await mcpContext.token().catch(() => null);
    if (!token) {
      ctx.io.stderr(
        'meter mcp: no session found; tools will return authentication errors until `meter login` has run or METER_ACCESS_TOKEN is set.\n'
      );
    }
    const bridge = createBridge({
      client: () => mcpContext.client(),
      log: (line) => ctx.io.stderr(line)
    });
    await serveStdio(bridge, { log: (line) => ctx.io.stderr(line) });
    return 0;
  }
};
