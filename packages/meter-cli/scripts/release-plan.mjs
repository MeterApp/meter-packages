// Metadata-only package edits must not publish an as-yet-unpublished version.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [eventName, before] = process.argv.slice(2);
if (!['push', 'workflow_dispatch'].includes(eventName)) {
  throw new Error('Only main pushes and explicit workflow dispatches can publish');
}
if (eventName === 'push' && !/^[0-9a-f]{40}$/.test(before ?? '')) {
  throw new Error('A valid previous commit is required to compare versions');
}
let publish = eventName === 'workflow_dispatch';
for (const directory of ['meter-sdk', 'meter-cli']) {
  const file = `packages/${directory}/package.json`;
  const current = JSON.parse(readFileSync(file, 'utf8'));
  if (current.private || eventName === 'workflow_dispatch') continue;
  // ls-tree distinguishes a newly added package from a broken/missing base ref.
  const existed = execFileSync('git', ['ls-tree', '--name-only', before, '--', file], {
    encoding: 'utf8'
  }).trim();
  const previous = existed
    ? JSON.parse(execFileSync('git', ['show', `${before}:${file}`], { encoding: 'utf8' }))
    : null;
  if (current.version !== previous?.version) publish = true;
}
console.log(`publish=${publish}`);
