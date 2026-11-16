import { spawn } from 'node:child_process';
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  statSync,
  unlinkSync,
  writeSync
} from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDir, readJsonFile, writeJsonFile } from './config.ts';
import type { Env } from './output.ts';
import { BIN_NAME, CLI_VERSION, PACKAGE_NAME } from './version.ts';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
/** How long a registry answer stands before the next command asks again, in the background. */
export const UPDATE_CHECK_TTL_MS = 60 * 60 * 1000;
/** A notice the CLI cannot act on itself (npx, METER_NO_AUTO_UPDATE, a failed install) repeats at most once a day. */
export const NOTICE_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** An automatic install of one version is tried again after a day; `meter update` tries now. */
export const INSTALL_RETRY_MS = 24 * 60 * 60 * 1000;
/** A lock older than this belongs to a worker that died. */
export const LOCK_STALE_MS = 10 * 60 * 1000;
export const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

/** `update-check.json` in the config directory: what the registry said and what the last automatic install did. */
export interface UpdateCache {
  checkedAt: number;
  latest: string | null;
  lastNoticeAt?: number;
  install?: InstallRecord;
}

export interface InstallRecord {
  version: string;
  /** The version that installed it. */
  from: string;
  at: number;
  ok: boolean;
  /** One line; the package manager's output is in `update.log`. */
  error?: string;
  /** The "updated" line was shown at a terminal. */
  announced?: boolean;
}

export interface UpdatePaths {
  cachePath: string;
  lockPath: string;
  logPath: string;
}

export function updatePaths(env: Env = process.env): UpdatePaths {
  const dir = configDir(env);
  return {
    cachePath: join(dir, 'update-check.json'),
    lockPath: join(dir, 'update.lock'),
    logPath: join(dir, 'update.log')
  };
}

function parseVersion(
  version: string
): { parts: number[]; pre: string | null } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(
    version.trim()
  );
  if (!match) return null;
  return {
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ?? null
  };
}

/** Semver-ish comparison; a prerelease sorts before its release. Unparsable versions compare equal. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let index = 0; index < 3; index += 1) {
    const l = left.parts[index] ?? 0;
    const r = right.parts[index] ?? 0;
    if (l !== r) return l < r ? -1 : 1;
  }
  if (left.pre && !right.pre) return -1;
  if (!left.pre && right.pre) return 1;
  if (left.pre && right.pre && left.pre !== right.pre)
    return left.pre < right.pre ? -1 : 1;
  return 0;
}

export function isNewer(
  latest: string | null | undefined,
  current: string
): latest is string {
  return typeof latest === 'string' && compareVersions(latest, current) > 0;
}

function truthy(value: string | undefined): boolean {
  return (
    value !== undefined &&
    value !== '' &&
    value !== '0' &&
    value.toLowerCase() !== 'false'
  );
}

/** `METER_NO_UPDATE_CHECK=1`, the conventional `NO_UPDATE_NOTIFIER=1`, or `CI`: no background check, install or notice. `meter update` still works. */
export function updateChecksDisabled(env: Env = process.env): boolean {
  return (
    truthy(env['METER_NO_UPDATE_CHECK']) ||
    truthy(env['NO_UPDATE_NOTIFIER']) ||
    truthy(env['CI'])
  );
}

/** `METER_NO_AUTO_UPDATE=1`: keep the check and the notices, install nothing by itself. */
export function autoUpdateDisabled(env: Env = process.env): boolean {
  return truthy(env['METER_NO_AUTO_UPDATE']);
}

/** `METER_NPM_REGISTRY` for mirrors and tests; otherwise the public registry. */
export function registryUrl(env: Env = process.env): string {
  return (env['METER_NPM_REGISTRY']?.trim() || DEFAULT_REGISTRY).replace(
    /\/+$/,
    ''
  );
}

export type FetchLikeMinimal = (
  input: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> }
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Latest published version from the npm registry, or null on any failure (a 404 before the first publish included). */
export async function fetchLatestVersion(
  fetchImpl: FetchLikeMinimal = fetch,
  timeoutMs = 2500,
  registry = DEFAULT_REGISTRY
): Promise<string | null> {
  try {
    const response = await fetchImpl(`${registry}/${PACKAGE_NAME}/latest`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/vnd.npm.install-v1+json, application/json'
      }
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === 'string' && parseVersion(body.version)
      ? body.version
      : null;
  } catch {
    return null;
  }
}

export async function readUpdateCache(
  cachePath: string
): Promise<UpdateCache | null> {
  const raw = await readJsonFile<Record<string, unknown>>(cachePath);
  if (!raw || typeof raw['checkedAt'] !== 'number') return null;
  const cache: UpdateCache = {
    checkedAt: raw['checkedAt'],
    latest: typeof raw['latest'] === 'string' ? raw['latest'] : null
  };
  if (typeof raw['lastNoticeAt'] === 'number')
    cache.lastNoticeAt = raw['lastNoticeAt'];
  const install = raw['install'] as Record<string, unknown> | undefined;
  if (
    install &&
    typeof install['version'] === 'string' &&
    typeof install['from'] === 'string' &&
    typeof install['at'] === 'number' &&
    typeof install['ok'] === 'boolean'
  ) {
    cache.install = {
      version: install['version'],
      from: install['from'],
      at: install['at'],
      ok: install['ok']
    };
    if (typeof install['error'] === 'string')
      cache.install.error = install['error'];
    if (install['announced'] === true) cache.install.announced = true;
  }
  return cache;
}

export interface CheckForUpdateOptions {
  cachePath: string;
  now?: number;
  force?: boolean;
  fetchImpl?: FetchLikeMinimal;
  ttlMs?: number;
  timeoutMs?: number;
  registry?: string;
}

/**
 * Reads the cache, asking the registry when it is stale or forced. A lookup
 * that fails keeps the last answer, so an offline machine is asked again at
 * the next interval rather than on every command.
 */
export async function checkForUpdate(
  options: CheckForUpdateOptions
): Promise<{ latest: string | null; cache: UpdateCache; fromCache: boolean }> {
  const now = options.now ?? Date.now();
  const ttl = options.ttlMs ?? UPDATE_CHECK_TTL_MS;
  const cached = await readUpdateCache(options.cachePath);
  if (!options.force && cached && now - cached.checkedAt < ttl) {
    return { latest: cached.latest, cache: cached, fromCache: true };
  }
  const fetched = await fetchLatestVersion(
    options.fetchImpl,
    options.timeoutMs,
    options.registry
  );
  const latest = fetched ?? cached?.latest ?? null;
  const cache: UpdateCache = { ...cached, checkedAt: now, latest };
  await writeJsonFile(options.cachePath, cache, 0o600).catch(() => undefined);
  return { latest, cache, fromCache: fetched === null };
}

async function patchCache(
  cachePath: string,
  patch: (cache: UpdateCache) => UpdateCache
): Promise<void> {
  const cache = await readUpdateCache(cachePath);
  if (!cache) return;
  await writeJsonFile(cachePath, patch(cache), 0o600).catch(() => undefined);
}

export function markNoticeShown(cachePath: string, now = Date.now()) {
  return patchCache(cachePath, (cache) => ({ ...cache, lastNoticeAt: now }));
}

export function markAnnounced(cachePath: string) {
  return patchCache(cachePath, (cache) =>
    cache.install
      ? { ...cache, install: { ...cache.install, announced: true } }
      : cache
  );
}

/** Records an install `meter update` ran in the foreground; the person saw it, so it is not announced again. */
export async function recordInstall(
  cachePath: string,
  install: Omit<InstallRecord, 'announced'>
): Promise<void> {
  const cache = (await readUpdateCache(cachePath)) ?? {
    checkedAt: install.at,
    latest: install.version
  };
  await writeJsonFile(
    cachePath,
    { ...cache, install: { ...install, announced: true } },
    0o600
  ).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// How this copy was installed, and the command that replaces it
// ---------------------------------------------------------------------------

export type InstallMethod =
  'npm' | 'pnpm' | 'yarn' | 'bun' | 'volta' | 'npx' | 'project' | 'source';

export interface InstallTarget {
  method: InstallMethod;
  /** The process that installs the new version; absent when this copy is not one the CLI can replace (npx cache, a project dependency, a source build). */
  command?: string;
  args?: string[];
  /** What a person would run, or do. */
  display: string;
  /** Why the install cannot happen here, e.g. a global directory this user cannot write. */
  blocked?: string;
}

export interface DetectInstallOptions {
  /** A file inside the installed package (default: this module). */
  modulePath?: string;
  version?: string;
  platform?: NodeJS.Platform;
  /** The Node binary running the CLI; the npm next to it installs into the same prefix. */
  execPath?: string;
  exists?: (path: string) => boolean;
  writable?: (path: string) => boolean;
}

function thisModulePath(): string {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return '';
  }
}

function isWritable(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** npm's own entry point beside the Node binary, so the install runs without a shell and lands in that Node's prefix. */
function npmCliPath(
  execPath: string,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean
): string | null {
  const dir = posix.dirname(execPath.replace(/\\/g, '/'));
  const candidate = posix.normalize(
    platform === 'win32'
      ? `${dir}/node_modules/npm/bin/npm-cli.js`
      : `${dir}/../lib/node_modules/npm/bin/npm-cli.js`
  );
  return exists(candidate) ? candidate : null;
}

/**
 * Works out from where this file lives how the CLI was installed, so an
 * update goes through the same package manager into the same directory:
 * a global npm install (`<prefix>/lib/node_modules`, or `<prefix>/node_modules`
 * on Windows, with the `meter` command beside it), pnpm, bun, yarn or Volta
 * globals, an npx/dlx cache, a project dependency or a source build.
 */
export function detectInstall(
  options: DetectInstallOptions = {}
): InstallTarget {
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? existsSync;
  const writable = options.writable ?? isWritable;
  const spec = `${PACKAGE_NAME}@${options.version ?? 'latest'}`;
  const path = (options.modulePath ?? thisModulePath()).replace(/\\/g, '/');
  const at = path.lastIndexOf(`/node_modules/${PACKAGE_NAME}/`);
  if (at < 0) return { method: 'source', display: 'rebuild it from source' };
  if (
    path.includes('/_npx/') ||
    /\/dlx[-/]/.test(path) ||
    path.includes('/.bun/install/cache/')
  ) {
    return { method: 'npx', display: `npx ${spec}` };
  }
  const nodeModules = path.slice(0, at + '/node_modules'.length);
  const blockedUnless = (dir: string) =>
    writable(dir) ? undefined : `${dir} is not writable by this user`;
  const managed = (
    method: InstallMethod,
    command: string,
    args: string[]
  ): InstallTarget => {
    const blocked = blockedUnless(nodeModules);
    return {
      method,
      command,
      args,
      display: [command, ...args].join(' '),
      ...(blocked ? { blocked } : {})
    };
  };
  if (path.includes('/.volta/'))
    return managed('volta', 'volta', ['install', spec]);
  if (path.includes('/pnpm/global/') || path.includes('/.pnpm-global/'))
    return managed('pnpm', 'pnpm', ['add', '--global', spec]);
  if (path.includes('/.bun/install/global/'))
    return managed('bun', 'bun', ['add', '--global', spec]);
  if (path.includes('/yarn/global/'))
    return managed('yarn', 'yarn', ['global', 'add', spec]);

  const parent = posix.dirname(nodeModules);
  const prefix =
    platform === 'win32'
      ? parent
      : posix.basename(parent) === 'lib'
        ? posix.dirname(parent)
        : null;
  const bin =
    prefix === null
      ? null
      : platform === 'win32'
        ? `${prefix}/${BIN_NAME}.cmd`
        : `${prefix}/bin/${BIN_NAME}`;
  if (prefix === null || bin === null || !exists(bin)) {
    return {
      method: 'project',
      display: `npm install ${spec} in the project that depends on it`
    };
  }
  const args = ['install', '--global', '--prefix', prefix, spec];
  const blocked =
    blockedUnless(nodeModules) ?? blockedUnless(posix.dirname(bin));
  const execPath = options.execPath ?? process.execPath;
  const npmCli = npmCliPath(execPath, platform, exists);
  return {
    method: 'npm',
    ...(npmCli
      ? { command: execPath, args: [npmCli, ...args] }
      : { command: 'npm', args }),
    display: `npm install -g ${spec}`,
    ...(blocked ? { blocked } : {})
  };
}

/** Quotes for cmd.exe, which `shell: true` hands the arguments to joined by spaces. */
function windowsArg(value: string): string {
  return /[\s"&|<>^]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Runs the install and resolves with its exit code; `stdio` is a file
 * descriptor (`update.log` for the background worker, 2 for `meter update`).
 * Never throws.
 */
export function runInstall(
  target: InstallTarget,
  stdio: 'ignore' | number,
  timeoutMs = INSTALL_TIMEOUT_MS
): Promise<{ code: number; error?: string }> {
  const { command, args } = target;
  if (!command || !args) {
    return Promise.resolve({
      code: 1,
      error: `cannot update this copy automatically: ${target.display}`
    });
  }
  return new Promise((resolve) => {
    // npm through the Node binary needs no shell; a package manager's own command is a .cmd shim on Windows.
    const shell = process.platform === 'win32' && command !== process.execPath;
    let settled = false;
    const finish = (result: { code: number; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const child = spawn(command, shell ? args.map(windowsArg) : args, {
      stdio: typeof stdio === 'number' ? ['ignore', stdio, stdio] : stdio,
      shell,
      windowsHide: true
    });
    const timer = setTimeout(() => {
      child.kill();
      finish({
        code: 1,
        error: `${target.display} took longer than ${Math.round(timeoutMs / 1000)} s`
      });
    }, timeoutMs);
    child.on('error', (error) =>
      finish({ code: 1, error: `could not start ${command}: ${error.message}` })
    );
    child.on('exit', (code, signal) =>
      finish(
        code === 0
          ? { code: 0 }
          : {
              code: code ?? 1,
              error: `${target.display} ${signal ? `stopped (${signal})` : `exited with ${code}`}`
            }
      )
    );
  });
}

// ---------------------------------------------------------------------------
// The background worker
// ---------------------------------------------------------------------------

/** Takes the update lock (exclusive create); breaks a lock left by a worker that died. */
export function acquireUpdateLock(lockPath: string, now = Date.now()): boolean {
  try {
    mkdirSync(posix.dirname(lockPath.replace(/\\/g, '/')), {
      recursive: true,
      mode: 0o700
    });
  } catch {
    return false;
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      closeSync(openSync(lockPath, 'wx', 0o600));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return false;
      try {
        if (now - statSync(lockPath).mtimeMs < LOCK_STALE_MS) return false;
        unlinkSync(lockPath);
      } catch {
        return false;
      }
    }
  }
  return false;
}

export function releaseUpdateLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // already gone
  }
}

export function updateLockHeld(lockPath: string, now = Date.now()): boolean {
  try {
    return now - statSync(lockPath).mtimeMs < LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function defaultCliPath(): string | undefined {
  try {
    return fileURLToPath(new URL('./bin.js', import.meta.url));
  } catch {
    return undefined;
  }
}

/**
 * Starts `meter update --worker` detached, so the command that noticed a
 * stale check never waits for the registry or an install. False when there
 * is nothing to run (tests run the TypeScript sources).
 */
export function spawnBackgroundUpdate(
  env: Env = process.env,
  cliPath: string | undefined = defaultCliPath()
): boolean {
  if (!cliPath || !existsSync(cliPath)) return false;
  try {
    const child = spawn(process.execPath, [cliPath, 'update', '--worker'], {
      detached: true,
      stdio: 'ignore',
      env: env as NodeJS.ProcessEnv,
      windowsHide: true
    });
    child.on('error', () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** True when the last automatic attempt at `version` is recent enough that it should not be repeated yet. */
function attemptedRecently(
  cache: UpdateCache | null,
  version: string,
  now: number
): boolean {
  const install = cache?.install;
  return Boolean(
    install &&
    install.version === version &&
    now - install.at < INSTALL_RETRY_MS
  );
}

export interface BackgroundUpdateOptions extends UpdatePaths {
  /** False under METER_NO_AUTO_UPDATE: check only. */
  autoUpdate: boolean;
  registry?: string;
  now?: number;
  fetchImpl?: FetchLikeMinimal;
  /** Injectable for tests. */
  target?: InstallTarget;
  install?: (
    target: InstallTarget,
    logPath: string
  ) => Promise<{ code: number; error?: string }>;
}

async function installLogged(
  target: InstallTarget,
  logPath: string
): Promise<{ code: number; error?: string }> {
  let fd: number;
  try {
    fd = openSync(logPath, 'w', 0o600);
  } catch {
    return runInstall(target, 'ignore');
  }
  try {
    writeSync(
      fd,
      `${new Date().toISOString()} meter ${CLI_VERSION}: ${target.display}\n`
    );
    return await runInstall(target, fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * What `meter update --worker` does: ask the registry and, unless
 * METER_NO_AUTO_UPDATE says otherwise, install a newer version with the
 * package manager that installed this one. The next command runs the new
 * version. One worker at a time; a failed version is retried after
 * `INSTALL_RETRY_MS`; only a version the registry just named is installed.
 */
export async function runBackgroundUpdate(
  options: BackgroundUpdateOptions
): Promise<UpdateCache | null> {
  const now = options.now ?? Date.now();
  if (!acquireUpdateLock(options.lockPath, now)) return null;
  try {
    const { latest, cache, fromCache } = await checkForUpdate({
      cachePath: options.cachePath,
      now,
      force: true,
      fetchImpl: options.fetchImpl,
      timeoutMs: 10_000,
      registry: options.registry
    });
    if (
      fromCache ||
      !isNewer(latest, CLI_VERSION) ||
      !options.autoUpdate ||
      attemptedRecently(cache, latest, now)
    )
      return cache;
    const target = options.target ?? detectInstall({ version: latest });
    if (!target.command || target.blocked) return cache;
    const outcome = await (options.install ?? installLogged)(
      target,
      options.logPath
    );
    const install: InstallRecord = {
      version: latest,
      from: CLI_VERSION,
      at: now,
      ok: outcome.code === 0,
      ...(outcome.error ? { error: outcome.error } : {})
    };
    const next: UpdateCache = {
      ...((await readUpdateCache(options.cachePath)) ?? cache),
      install
    };
    await writeJsonFile(options.cachePath, next, 0o600).catch(() => undefined);
    return next;
  } finally {
    releaseUpdateLock(options.lockPath);
  }
}

// ---------------------------------------------------------------------------
// What a command does before it runs
// ---------------------------------------------------------------------------

export type UpdatePlan =
  | { action: 'none' }
  /** A background install of this version finished; say so once. */
  | { action: 'announce'; from: string; version: string }
  | { action: 'notice'; latest: string; message: string };

export interface PlanUpdateInput {
  cache: UpdateCache | null;
  current: string;
  autoUpdate: boolean;
  target: InstallTarget;
  now: number;
}

/**
 * Decides, from the cache alone (no network), whether a command should start
 * the background worker and what, if anything, to tell a person at a terminal:
 * that a background update landed, or that a newer version needs them (an
 * npx or project copy, METER_NO_AUTO_UPDATE, a directory they cannot write,
 * an install that failed).
 */
export function planUpdate(input: PlanUpdateInput): {
  spawn: boolean;
  plan: UpdatePlan;
} {
  const { cache, current, autoUpdate, target, now } = input;
  const latest = cache?.latest ?? null;
  const stale = !cache || now - cache.checkedAt >= UPDATE_CHECK_TTL_MS;
  const installable = Boolean(target.command) && !target.blocked;
  const newer = isNewer(latest, current);
  // A fresh answer that names a newer version still needs a worker when nothing has tried to install it yet.
  const pending =
    newer &&
    autoUpdate &&
    installable &&
    !attemptedRecently(cache, latest, now);
  const spawnWorker = stale || pending;

  const install = cache?.install;
  if (
    install?.ok &&
    !install.announced &&
    compareVersions(install.version, current) === 0
  ) {
    return {
      spawn: spawnWorker,
      plan: { action: 'announce', from: install.from, version: install.version }
    };
  }
  // A source build is a developer's checkout: they update it with git.
  if (!newer || target.method === 'source')
    return { spawn: spawnWorker, plan: { action: 'none' } };
  if (
    cache?.lastNoticeAt !== undefined &&
    now - cache.lastNoticeAt < NOTICE_INTERVAL_MS
  )
    return { spawn: spawnWorker, plan: { action: 'none' } };

  const head = `Update available: meter ${current} → ${latest}.`;
  const notice = (message: string) => ({
    spawn: spawnWorker,
    plan: { action: 'notice' as const, latest, message }
  });
  if (target.method === 'npx')
    return notice(`${head} \`npx ${PACKAGE_NAME}@latest\` runs it.`);
  if (!target.command)
    return notice(`${head} Update it with: ${target.display}.`);
  if (target.blocked)
    return notice(
      `${head} It cannot install itself (${target.blocked}); run: ${target.display}`
    );
  if (!autoUpdate)
    return notice(
      `${head} Run \`meter update\` (METER_NO_AUTO_UPDATE is set).`
    );
  if (install && !install.ok && install.version === latest) {
    return notice(
      `${head} The automatic update failed (${install.error ?? 'see update.log'}); run \`meter update\`.`
    );
  }
  // Installing it in the background, now or already: nothing to say yet.
  return { spawn: spawnWorker, plan: { action: 'none' } };
}
