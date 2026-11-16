import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const script = fileURLToPath(new URL('./release-plan.mjs', import.meta.url));
function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'meter-release-plan-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const directory of ['meter-sdk', 'meter-cli']) {
    mkdirSync(join(cwd, 'packages', directory), { recursive: true });
    writeFileSync(join(cwd, 'packages', directory, 'package.json'), JSON.stringify({
      name: `@meterapp/${directory}`, version: '1.0.0', engines: { node: '>=20' }
    }));
  }
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init'); git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'baseline');
  return { cwd, before: git('rev-parse', 'HEAD') };
}
function edit(cwd, directory, values) {
  const file = join(cwd, 'packages', directory, 'package.json');
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), ...values }));
}
function plan(repo, event = 'push', before = repo.before) {
  return spawnSync(process.execPath, [script, event, before], { cwd: repo.cwd, encoding: 'utf8' });
}

test('metadata-only edits do not publish, even when npm has no version yet', (t) => {
  const repo = repository(t);
  edit(repo.cwd, 'meter-sdk', { engines: { node: '>=20.10' } });
  edit(repo.cwd, 'meter-cli', { scripts: { test: 'node --test' } });
  const result = plan(repo);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'publish=false');
});
for (const directory of ['meter-sdk', 'meter-cli']) {
  test(`${directory} version change releases the package pair`, (t) => {
    const repo = repository(t); edit(repo.cwd, directory, { version: '1.0.1' });
    const result = plan(repo);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'publish=true');
  });
}
test('explicit workflow dispatch can retry a release without a version change', (t) => {
  const result = plan(repository(t), 'workflow_dispatch', '');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'publish=true');
});
test('missing comparison history fails closed', (t) => {
  const result = plan(repository(t), 'push', 'a'.repeat(40));
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});
