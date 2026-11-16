import { parseArgs, type ParsedArgs } from './args.ts';
import { createClientContext } from './client.ts';
import { ALIASES } from './commands/call.ts';
import { COMMANDS, findCommand, helpEntries } from './commands/index.ts';
import { helpText } from './commands/help.ts';
import type { CommandContext, CommandDefinition } from './context.ts';
import { describeError } from './errors.ts';
import type { FetchLike } from './oauth/discovery.ts';
import { createIo, paint, type Env, type Io } from './output.ts';
import {
  autoUpdateDisabled,
  detectInstall,
  markAnnounced,
  markNoticeShown,
  planUpdate,
  readUpdateCache,
  registryUrl,
  runBackgroundUpdate,
  spawnBackgroundUpdate,
  updateChecksDisabled,
  updateLockHeld,
  updatePaths
} from './update.ts';
import { CLI_VERSION } from './version.ts';

export interface MainDeps {
  env?: Env;
  fetch?: FetchLike;
  /** Overrides for tests (non-TTY, captured output). */
  io?: Partial<Io>;
  cwd?: string;
  now?: () => number;
  /** Disable the update check and the background update (tests). */
  skipUpdateCheck?: boolean;
}

export function renderError(error: unknown, io: Io): number {
  const described = describeError(error);
  if (io.json) {
    io.stdout(
      `${JSON.stringify({ error: { message: described.message, hint: described.hint ?? null, request_id: described.requestId ?? null, status: described.status ?? null, code: described.code ?? null } }, null, 2)}\n`
    );
  } else {
    io.stderr(`${paint(io, 'red', '✗')} ${described.message}\n`);
    if (described.hint)
      io.stderr(`  ${paint(io, 'yellow', '→')} ${described.hint}\n`);
    if (described.requestId)
      io.stderr(
        `  ${paint(io, 'dim', `request id: ${described.requestId}`)}\n`
      );
  }
  return described.exitCode;
}

/**
 * The update step of every command but `update`, from the cache alone: starts
 * the background worker when the registry's answer is stale or a newer version
 * waits to be installed, and returns the line to print after the command at a
 * terminal. Agents, scripts and the MCP bridge get the background update and
 * nothing on their streams. Never waits for the network, never fails the
 * command.
 */
async function updateBeforeCommand(
  env: Env,
  io: Io,
  commandName: string
): Promise<string | null> {
  if (updateChecksDisabled(env)) return null;
  try {
    const { cachePath, lockPath } = updatePaths(env);
    const cache = await readUpdateCache(cachePath);
    const now = Date.now();
    const { spawn, plan } = planUpdate({
      cache,
      current: CLI_VERSION,
      autoUpdate: !autoUpdateDisabled(env),
      target: detectInstall(),
      now
    });
    if (spawn && !updateLockHeld(lockPath, now)) spawnBackgroundUpdate(env);
    if (
      plan.action === 'none' ||
      commandName === 'mcp' ||
      !io.isTTY ||
      io.json ||
      io.quiet
    )
      return null;
    if (plan.action === 'announce') {
      await markAnnounced(cachePath);
      return paint(
        io,
        'dim',
        `meter updated itself: ${plan.from} → ${plan.version}.`
      );
    }
    await markNoticeShown(cachePath, now);
    return paint(io, 'yellow', plan.message);
  } catch {
    return null;
  }
}

/** Entry point shared by the binary and tests. Resolves with the process exit code. */
export async function main(
  argv: string[],
  deps: MainDeps = {}
): Promise<number> {
  const env = deps.env ?? process.env;
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const io = { ...createIo({}, env), ...deps.io };
    return renderError(error, io);
  }
  const io: Io = { ...createIo(args.flags, env), ...deps.io };

  if (args.flags['version'] === true) {
    io.stdout(`${CLI_VERSION}\n`);
    return 0;
  }

  const requested = args.command;
  const command: CommandDefinition | undefined = requested
    ? findCommand(requested)
    : undefined;
  if (!requested) {
    io.stdout(helpText(helpEntries()));
    return 0;
  }
  if (!command) {
    io.stderr(
      `Unknown command "${requested}". Commands: ${COMMANDS.map((entry) => entry.name).join(', ')}\n`
    );
    return 2;
  }
  // Tool-shaped commands render their own `--help` (the tool's arguments).
  const toolShaped = command.name === 'call' || command.name in ALIASES;
  if (args.flags['help'] === true && !toolShaped) {
    io.stdout(helpText(helpEntries(), command.name));
    return 0;
  }

  if (command.name === 'update' && args.flags['worker'] === true) {
    // The detached worker another command started: no output, one at a time.
    await runBackgroundUpdate({
      ...updatePaths(env),
      autoUpdate: !autoUpdateDisabled(env),
      registry: registryUrl(env)
    });
    return 0;
  }
  const updateNotice =
    deps.skipUpdateCheck || command.name === 'update'
      ? null
      : await updateBeforeCommand(env, io, command.name);

  let code: number;
  try {
    const app = ALIASES[command.name]?.app;
    const clientContext = createClientContext(args.flags, env, {
      fetch: deps.fetch,
      now: deps.now,
      ...(app ? { app } : {})
    });
    const context: CommandContext = {
      args,
      io,
      env,
      cwd: deps.cwd ?? process.cwd(),
      clientContext,
      now: deps.now ?? (() => Date.now())
    };
    code = await command.run(context);
  } catch (error) {
    code = renderError(error, io);
  }
  if (updateNotice) io.stderr(`${updateNotice}\n`);
  return code;
}
