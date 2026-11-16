import { execFile } from 'node:child_process';

/** One plugin install `meter update` refreshed (or tried to). */
export interface PluginRefresh {
  host: 'Claude Code' | 'Codex';
  /** `<plugin>@<marketplace>` */
  id: string;
  ok: boolean;
  detail: string;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  timeoutMs: number
) => Promise<RunResult>;

/** Runs a host's CLI without a shell (a `.cmd` shim needs one on Windows); a missing command is a non-zero code, never a throw. */
export const runHostCommand: CommandRunner = (command, args, timeoutMs) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        shell: process.platform === 'win32',
        maxBuffer: 8 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        const code = error
          ? typeof error.code === 'number'
            ? error.code
            : 1
          : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      }
    );
  });

/** Where Claude Code installed `plugin`, from `claude plugin list --json`. */
export function claudeInstalls(
  stdout: string,
  plugin: string
): Array<{ id: string; marketplace: string; scope?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry: unknown) => {
    const record = (entry && typeof entry === 'object' ? entry : {}) as Record<
      string,
      unknown
    >;
    const id = typeof record['id'] === 'string' ? record['id'] : '';
    const [name, marketplace] = id.split('@');
    if (name !== plugin || !marketplace) return [];
    return [
      {
        id,
        marketplace,
        ...(typeof record['scope'] === 'string'
          ? { scope: record['scope'] }
          : {})
      }
    ];
  });
}

/** The marketplaces `plugin` is installed from in Codex, read off `codex plugin list`'s table. */
export function codexMarketplaces(stdout: string, plugin: string): string[] {
  const marketplaces = new Set<string>();
  for (const line of stdout.split('\n')) {
    const match = /^(\S+)@(\S+)\s+installed\b/.exec(line.trim());
    if (match && match[1] === plugin && match[2]) marketplaces.add(match[2]);
  }
  return [...marketplaces];
}

function lastLine(text: string): string {
  return (
    text
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .pop() ?? ''
  );
}

/** The `message` of the one-line JSON result Claude Code prints with `--json`. */
function jsonMessage(stdout: string): string | null {
  for (const line of stdout.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const parsed = JSON.parse(line) as { message?: unknown };
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      // not the result line
    }
  }
  return null;
}

/** The Meter plugins, one per hosted MCP server. */
export const METER_PLUGINS = ['meter-fleet', 'meter-rides'] as const;
/** The combined plugin 2.0.0 split in two; marketplaces no longer offer it. */
export const RETIRED_METER_PLUGIN = 'meter';

function retiredPluginDetail(id: string): string {
  return `replaced by meter-fleet and meter-rides: uninstall ${id}, then install either or both`;
}

/**
 * Brings the given plugin installs of Claude Code and Codex up to date:
 * refreshes each marketplace that installed one, then the plugin (Claude
 * Code), or the marketplace snapshot (Codex). A host that is not installed, or
 * does not have the plugin, is skipped without a word. An install of the
 * retired combined plugin cannot update, so it reports what to do instead.
 */
export async function refreshHostPlugins(
  plugins: readonly string[],
  run: CommandRunner = runHostCommand
): Promise<PluginRefresh[]> {
  const results: PluginRefresh[] = [];

  const claude = await run('claude', ['plugin', 'list', '--json'], 30_000);
  if (claude.code === 0) {
    const installs = plugins.flatMap((plugin) =>
      claudeInstalls(claude.stdout, plugin)
    );
    for (const { id } of claudeInstalls(claude.stdout, RETIRED_METER_PLUGIN)) {
      results.push({
        host: 'Claude Code',
        id,
        ok: false,
        detail: retiredPluginDetail(id)
      });
    }
    const failedMarketplaces = new Map<string, string>();
    for (const marketplace of new Set(
      installs.map((install) => install.marketplace)
    )) {
      const refreshed = await run(
        'claude',
        ['plugin', 'marketplace', 'update', marketplace, '--json'],
        120_000
      );
      if (refreshed.code !== 0) {
        failedMarketplaces.set(
          marketplace,
          jsonMessage(refreshed.stdout) ??
            (lastLine(refreshed.stderr || refreshed.stdout) ||
              `exit ${refreshed.code}`)
        );
      }
    }
    for (const install of installs) {
      const failed = failedMarketplaces.get(install.marketplace);
      if (failed) {
        results.push({
          host: 'Claude Code',
          id: install.id,
          ok: false,
          detail: `marketplace ${install.marketplace}: ${failed}`
        });
        continue;
      }
      const updated = await run(
        'claude',
        [
          'plugin',
          'update',
          install.id,
          '--json',
          ...(install.scope ? ['--scope', install.scope] : [])
        ],
        120_000
      );
      const detail =
        jsonMessage(updated.stdout) ??
        (lastLine(
          updated.code === 0 ? updated.stdout : updated.stderr || updated.stdout
        ) ||
          (updated.code === 0 ? 'up to date' : `exit ${updated.code}`));
      results.push({
        host: 'Claude Code',
        id: install.id,
        ok: updated.code === 0,
        detail
      });
    }
  }

  const codex = await run('codex', ['plugin', 'list'], 30_000);
  if (codex.code === 0) {
    for (const marketplace of codexMarketplaces(
      codex.stdout,
      RETIRED_METER_PLUGIN
    )) {
      const id = `${RETIRED_METER_PLUGIN}@${marketplace}`;
      results.push({
        host: 'Codex',
        id,
        ok: false,
        detail: retiredPluginDetail(id)
      });
    }
    const installed = plugins.flatMap((plugin) =>
      codexMarketplaces(codex.stdout, plugin).map((marketplace) => ({
        id: `${plugin}@${marketplace}`,
        marketplace
      }))
    );
    for (const marketplace of new Set(
      installed.map((install) => install.marketplace)
    )) {
      const upgraded = await run(
        'codex',
        ['plugin', 'marketplace', 'upgrade', marketplace],
        120_000
      );
      const detail =
        lastLine(
          upgraded.code === 0
            ? upgraded.stdout
            : upgraded.stderr || upgraded.stdout
        ) ||
        (upgraded.code === 0
          ? 'marketplace refreshed'
          : `exit ${upgraded.code}`);
      for (const install of installed) {
        if (install.marketplace !== marketplace) continue;
        results.push({
          host: 'Codex',
          id: install.id,
          ok: upgraded.code === 0,
          detail
        });
      }
    }
  }
  return results;
}
