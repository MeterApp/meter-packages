import type { CommandContext, CommandDefinition } from '../context.ts';
import { CliError } from '../errors.ts';
import { METER_PLUGINS, refreshHostPlugins } from '../host-plugins.ts';
import { fail, ok, printJson, warn } from '../output.ts';
import {
  autoUpdateDisabled,
  checkForUpdate,
  detectInstall,
  isNewer,
  recordInstall,
  registryUrl,
  runInstall,
  updatePaths
} from '../update.ts';
import { CLI_VERSION, PACKAGE_NAME } from '../version.ts';

export const updateCommand: CommandDefinition = {
  name: 'update',
  summary:
    'Update the CLI now, and the Meter plugins in Claude Code and Codex (new CLI versions also install themselves in the background); --check only reports',
  usage:
    'meter update [--check] [--no-plugins] [--json]\n  A global install checks npm in the background at most once an hour and installs a newer version itself.\n  METER_NO_AUTO_UPDATE=1 only reports it; METER_NO_UPDATE_CHECK=1 (or CI) turns the check off.',
  async run(ctx: CommandContext): Promise<number> {
    const { io } = ctx;
    const { cachePath } = updatePaths(ctx.env);
    const { latest, fromCache } = await checkForUpdate({
      cachePath,
      force: true,
      timeoutMs: 8000,
      registry: registryUrl(ctx.env)
    });
    const newer = isNewer(latest, CLI_VERSION);
    const target = detectInstall({ version: newer ? latest : 'latest' });
    const report = {
      current: CLI_VERSION,
      latest,
      update_available: newer,
      registry_reached: !fromCache,
      auto_update: !autoUpdateDisabled(ctx.env),
      install: {
        method: target.method,
        command: target.display,
        blocked: target.blocked ?? null
      }
    };

    if (ctx.args.flags['check'] === true) {
      if (io.json) {
        printJson(io, report);
        return 0;
      }
      if (fromCache)
        io.stdout(
          `${warn(io, `Could not reach the npm registry; running ${CLI_VERSION}${latest ? ` (last known latest: ${latest})` : ''}.`)}\n`
        );
      else if (newer)
        io.stdout(
          `Update available: ${CLI_VERSION} → ${latest}. Run: ${target.method === 'npx' ? `npx ${PACKAGE_NAME}@latest` : 'meter update'}\n`
        );
      else io.stdout(`${ok(io, `meter ${CLI_VERSION} is up to date.`)}\n`);
      return 0;
    }

    let cli: string;
    if (fromCache) {
      cli = `Could not reach the npm registry; meter stays at ${CLI_VERSION}.`;
      if (!io.json) io.stdout(`${warn(io, cli)}\n`);
    } else if (!newer) {
      cli = `meter ${CLI_VERSION} is up to date.`;
      if (!io.json) io.stdout(`${ok(io, cli)}\n`);
    } else if (target.method === 'npx') {
      cli = `You are running through npx; the next \`npx ${PACKAGE_NAME}@latest\` call uses ${latest}.`;
      if (!io.json) io.stdout(`${cli}\n`);
    } else if (!target.command) {
      cli = `meter ${latest} is available; this copy updates with: ${target.display}.`;
      if (!io.json) io.stdout(`${cli}\n`);
    } else {
      if (target.blocked) {
        throw new CliError(
          `Cannot update meter here: ${target.blocked}.`,
          1,
          `Run ${target.display} as a user who can write there, or move npm's global prefix to a directory you own (npm config set prefix ~/.npm-global).`
        );
      }
      io.stderr(
        `Updating meter ${CLI_VERSION} → ${latest} (${target.display})…\n`
      );
      // The package manager's output goes to stderr, so --json stays one document on stdout.
      const outcome = await runInstall(target, 2);
      await recordInstall(cachePath, {
        version: latest,
        from: CLI_VERSION,
        at: Date.now(),
        ok: outcome.code === 0,
        ...(outcome.error ? { error: outcome.error } : {})
      });
      if (outcome.code !== 0) {
        throw new CliError(
          `Update failed (${outcome.error ?? `exit ${outcome.code}`}).`,
          1,
          `Run manually: ${target.display} (add sudo only if your global prefix requires it, or switch to a user-writable prefix).`
        );
      }
      cli = `Updated meter to ${latest}.`;
      if (!io.json) io.stdout(`${ok(io, cli)}\n`);
    }

    const plugins =
      ctx.args.flags['plugins'] === false
        ? []
        : await refreshHostPlugins(METER_PLUGINS);
    const failed = plugins.some((entry) => !entry.ok);
    if (io.json) {
      printJson(io, { ...report, cli, plugins });
      return failed ? 1 : 0;
    }
    for (const entry of plugins) {
      const line = `${entry.host}: ${entry.id} — ${entry.detail}`;
      io.stdout(`${entry.ok ? ok(io, line) : fail(io, line)}\n`);
    }
    if (plugins.some((entry) => entry.host === 'Claude Code' && entry.ok)) {
      io.stdout(
        'Restart Claude Code (or run /reload-plugins) to load the plugins. To have Claude Code keep them current: /plugin → Marketplaces → choose the marketplace → Enable auto-update.\n'
      );
    }
    return failed ? 1 : 0;
  }
};
