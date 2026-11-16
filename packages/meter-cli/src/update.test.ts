import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from './main.ts';
import { captureIo } from './test-helpers/fake-meter.ts';
import {
  acquireUpdateLock,
  checkForUpdate,
  compareVersions,
  detectInstall,
  INSTALL_RETRY_MS,
  isNewer,
  LOCK_STALE_MS,
  NOTICE_INTERVAL_MS,
  planUpdate,
  readUpdateCache,
  releaseUpdateLock,
  runBackgroundUpdate,
  UPDATE_CHECK_TTL_MS,
  updateChecksDisabled,
  type FetchLikeMinimal,
  type InstallTarget,
  type PlanUpdateInput,
  type UpdateCache
} from './update.ts';
import { CLI_VERSION } from './version.ts';

describe('versions and switches', () => {
  it('orders semver including prereleases', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0-beta.1', '2.0.0')).toBe(-1);
    expect(compareVersions('garbage', '1.0.0')).toBe(0);
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
    expect(isNewer(null, '1.0.0')).toBe(false);
  });

  it('is off in CI and when NO_UPDATE_NOTIFIER or METER_NO_UPDATE_CHECK says so', () => {
    expect(updateChecksDisabled({})).toBe(false);
    expect(updateChecksDisabled({ CI: 'true' })).toBe(true);
    expect(updateChecksDisabled({ CI: '0' })).toBe(false);
    expect(updateChecksDisabled({ NO_UPDATE_NOTIFIER: '1' })).toBe(true);
    expect(updateChecksDisabled({ METER_NO_UPDATE_CHECK: '1' })).toBe(true);
  });
});

describe('detectInstall', () => {
  const all = () => true;

  it('updates a global npm install in its own prefix, with the npm beside the running Node', () => {
    expect(
      detectInstall({
        modulePath:
          '/opt/homebrew/lib/node_modules/@meterapp/meter/dist/update.js',
        version: '2.0.0',
        platform: 'darwin',
        execPath: '/opt/homebrew/bin/node',
        exists: all,
        writable: all
      })
    ).toEqual({
      method: 'npm',
      command: '/opt/homebrew/bin/node',
      args: [
        '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
        'install',
        '--global',
        '--prefix',
        '/opt/homebrew',
        '@meterapp/meter@2.0.0'
      ],
      display: 'npm install -g @meterapp/meter@2.0.0'
    });
    expect(
      detectInstall({
        modulePath: '/usr/lib/node_modules/@meterapp/meter/dist/update.js',
        platform: 'linux',
        exists: (path) => !path.endsWith('npm-cli.js'),
        writable: () => false
      })
    ).toMatchObject({
      command: 'npm',
      blocked: '/usr/lib/node_modules is not writable by this user'
    });
  });

  it('uses the package manager that owns the install, and never replaces an npx, project or source copy', () => {
    const at = (modulePath: string, exists = all) =>
      detectInstall({ modulePath, exists, writable: all });
    expect(
      at(
        '/Users/me/Library/pnpm/global/5/node_modules/.pnpm/@meterapp+meter@1.0.0/node_modules/@meterapp/meter/dist/update.js'
      )
    ).toMatchObject({ method: 'pnpm', command: 'pnpm' });
    expect(
      at(
        '/Users/me/.bun/install/global/node_modules/@meterapp/meter/dist/update.js'
      )
    ).toMatchObject({ method: 'bun' });
    expect(
      at('/Users/me/.npm/_npx/abc/node_modules/@meterapp/meter/dist/update.js')
    ).toEqual({ method: 'npx', display: 'npx @meterapp/meter@latest' });
    expect(
      at(
        '/Users/me/app/node_modules/@meterapp/meter/dist/update.js',
        () => false
      )
    ).toMatchObject({ method: 'project' });
    expect(at('/Users/me/meter-repo/packages/meter-cli/src/update.ts')).toEqual(
      {
        method: 'source',
        display: 'rebuild it from source'
      }
    );
  });
});

describe('planUpdate', () => {
  const now = 1_800_000_000_000;
  const npm: InstallTarget = {
    method: 'npm',
    command: 'npm',
    args: [],
    display: 'npm install -g @meterapp/meter@latest'
  };
  const fresh = (extra: Partial<UpdateCache> = {}): UpdateCache => ({
    checkedAt: now - 60_000,
    latest: '1.1.0',
    ...extra
  });
  const base: PlanUpdateInput = {
    cache: fresh(),
    current: '1.0.0',
    autoUpdate: true,
    target: npm,
    now
  };

  it('starts the worker when the answer is stale or a newer version waits, and stays quiet', () => {
    expect(planUpdate({ ...base, cache: null }).spawn).toBe(true);
    expect(
      planUpdate({
        ...base,
        cache: fresh({ checkedAt: now - UPDATE_CHECK_TTL_MS, latest: '1.0.0' })
      }).spawn
    ).toBe(true);
    expect(planUpdate({ ...base, cache: fresh({ latest: '1.0.0' }) })).toEqual({
      spawn: false,
      plan: { action: 'none' }
    });
    expect(planUpdate(base)).toEqual({ spawn: true, plan: { action: 'none' } });
    const tried = fresh({
      install: { version: '1.1.0', from: '1.0.0', at: now - 60_000, ok: true }
    });
    expect(planUpdate({ ...base, cache: tried })).toEqual({
      spawn: false,
      plan: { action: 'none' }
    });
  });

  it('announces a finished background update once', () => {
    const done = fresh({
      install: { version: '1.1.0', from: '1.0.0', at: now - 60_000, ok: true }
    });
    expect(planUpdate({ ...base, cache: done, current: '1.1.0' }).plan).toEqual(
      {
        action: 'announce',
        from: '1.0.0',
        version: '1.1.0'
      }
    );
    expect(
      planUpdate({
        ...base,
        cache: { ...done, install: { ...done.install!, announced: true } },
        current: '1.1.0'
      }).plan
    ).toEqual({ action: 'none' });
  });

  it('tells a person what it cannot do itself, at most once a day', () => {
    const failed = fresh({
      install: {
        version: '1.1.0',
        from: '1.0.0',
        at: now - 60_000,
        ok: false,
        error: 'npm exited with 1'
      }
    });
    expect(planUpdate({ ...base, cache: failed }).plan).toMatchObject({
      action: 'notice',
      message: expect.stringContaining(
        'The automatic update failed (npm exited with 1)'
      )
    });
    expect(planUpdate({ ...base, autoUpdate: false })).toMatchObject({
      spawn: false,
      plan: {
        action: 'notice',
        message: expect.stringContaining('METER_NO_AUTO_UPDATE')
      }
    });
    expect(
      planUpdate({
        ...base,
        target: { method: 'npx', display: 'npx @meterapp/meter@latest' }
      }).plan
    ).toMatchObject({ action: 'notice' });
    expect(
      planUpdate({ ...base, target: { ...npm, blocked: 'not writable' } }).plan
    ).toMatchObject({
      action: 'notice',
      message: expect.stringContaining('cannot install itself')
    });
    expect(
      planUpdate({
        ...base,
        target: { method: 'source', display: 'rebuild it from source' }
      }).plan
    ).toEqual({ action: 'none' });
    expect(
      planUpdate({
        ...base,
        autoUpdate: false,
        cache: fresh({ lastNoticeAt: now - 60_000 })
      }).plan
    ).toEqual({ action: 'none' });
    expect(
      planUpdate({
        ...base,
        autoUpdate: false,
        cache: fresh({ lastNoticeAt: now - NOTICE_INTERVAL_MS })
      }).plan.action
    ).toBe('notice');
  });
});

describe('the background worker', () => {
  let dir: string;
  let paths: { cachePath: string; lockPath: string; logPath: string };
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'meter-update-'));
    paths = {
      cachePath: join(dir, 'update-check.json'),
      lockPath: join(dir, 'update.lock'),
      logPath: join(dir, 'update.log')
    };
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const newer = '99.0.0';
  const registry: FetchLikeMinimal = async () => ({
    ok: true,
    json: async () => ({ version: newer })
  });
  const target: InstallTarget = {
    method: 'npm',
    command: 'npm',
    args: ['install'],
    display: 'npm install -g @meterapp/meter@99.0.0'
  };

  it('keeps the last answer when the registry fails, a 404 before the first publish included', async () => {
    const now = 1_700_000_000_000;
    await checkForUpdate({
      cachePath: paths.cachePath,
      now,
      fetchImpl: registry
    });
    const missing: FetchLikeMinimal = async () => ({
      ok: false,
      json: async () => ({})
    });
    const result = await checkForUpdate({
      cachePath: paths.cachePath,
      now: now + UPDATE_CHECK_TTL_MS,
      fetchImpl: missing
    });
    expect(result).toMatchObject({ latest: newer, fromCache: true });
  });

  it('installs a newer version, records it, and does not retry a failure before the interval', async () => {
    const calls: InstallTarget[] = [];
    const install = async (installTarget: InstallTarget) => {
      calls.push(installTarget);
      return { code: 0 };
    };
    const cache = await runBackgroundUpdate({
      ...paths,
      autoUpdate: true,
      now: 5_000,
      fetchImpl: registry,
      target,
      install
    });
    expect(calls).toEqual([target]);
    expect(cache?.install).toEqual({
      version: newer,
      from: CLI_VERSION,
      at: 5_000,
      ok: true
    });

    const failing = async () => ({ code: 1, error: 'npm exited with 1' });
    await rm(paths.cachePath);
    await runBackgroundUpdate({
      ...paths,
      autoUpdate: true,
      now: 5_000,
      fetchImpl: registry,
      target,
      install: failing
    });
    expect((await readUpdateCache(paths.cachePath))?.install).toMatchObject({
      ok: false,
      error: 'npm exited with 1'
    });
    await runBackgroundUpdate({
      ...paths,
      autoUpdate: true,
      now: 5_000 + INSTALL_RETRY_MS - 1,
      fetchImpl: registry,
      target,
      install
    });
    expect(calls).toHaveLength(1);
  });

  it('only checks when auto-update is off, offline, for a copy it cannot replace, or while another worker runs', async () => {
    const calls: InstallTarget[] = [];
    const install = async (installTarget: InstallTarget) => {
      calls.push(installTarget);
      return { code: 0 };
    };
    await runBackgroundUpdate({
      ...paths,
      autoUpdate: false,
      fetchImpl: registry,
      target,
      install
    });
    await runBackgroundUpdate({
      ...paths,
      autoUpdate: true,
      fetchImpl: registry,
      target: { method: 'npx', display: 'npx @meterapp/meter@latest' },
      install
    });
    await runBackgroundUpdate({
      ...paths,
      autoUpdate: true,
      fetchImpl: registry,
      target: { ...target, blocked: 'not writable' },
      install
    });
    await runBackgroundUpdate({
      ...paths,
      autoUpdate: true,
      fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
      target,
      install
    });
    expect(calls).toEqual([]);
    expect(acquireUpdateLock(paths.lockPath)).toBe(true);
    expect(
      await runBackgroundUpdate({
        ...paths,
        autoUpdate: true,
        fetchImpl: registry,
        target,
        install
      })
    ).toBeNull();
    releaseUpdateLock(paths.lockPath);
  });

  it('breaks a lock left by a worker that died', async () => {
    expect(acquireUpdateLock(paths.lockPath)).toBe(true);
    expect(acquireUpdateLock(paths.lockPath)).toBe(false);
    const old = new Date(Date.now() - LOCK_STALE_MS - 1000);
    await utimes(paths.lockPath, old, old);
    expect(acquireUpdateLock(paths.lockPath)).toBe(true);
  });

  it('runs as `meter update --worker` silently, and `meter update --check` reports it', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ name: '@meterapp/meter', version: newer }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const env = {
      METER_CONFIG_DIR: dir,
      HOME: dir,
      METER_NPM_REGISTRY: `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    };
    try {
      const worker = captureIo();
      expect(await main(['update', '--worker'], { env, io: worker.io })).toBe(
        0
      );
      expect(worker.stdout() + worker.stderr()).toBe('');
      expect(JSON.parse(await readFile(paths.cachePath, 'utf8'))).toMatchObject(
        { latest: newer }
      );
      const check = captureIo({ json: true });
      expect(
        await main(['update', '--check', '--json'], { env, io: check.io })
      ).toBe(0);
      expect(JSON.parse(check.stdout())).toMatchObject({
        current: CLI_VERSION,
        latest: newer,
        update_available: true,
        registry_reached: true,
        auto_update: true,
        install: { method: 'source' }
      });
    } finally {
      server.close();
    }
    await writeFile(paths.cachePath, '{');
    expect(await readUpdateCache(paths.cachePath)).toBeNull();
  });
});
