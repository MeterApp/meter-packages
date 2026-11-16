// Makes dist/bin.js executable and rewrites `.ts` specifiers left in declaration files.
import { chmod, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

for (const file of await walk(dist)) {
  if (file.endsWith('.d.ts')) {
    const source = await readFile(file, 'utf8');
    const rewritten = source
      .replace(/(from\s+['"]\.{1,2}\/[^'"]+?)\.ts(['"])/g, '$1.js$2')
      .replace(/(import\(['"]\.{1,2}\/[^'"]+?)\.ts(['"]\))/g, '$1.js$2');
    if (rewritten !== source) await writeFile(file, rewritten, 'utf8');
  }
}
await chmod(join(dist, 'bin.js'), 0o755);
