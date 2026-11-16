import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CLI_VERSION, PACKAGE_NAME } from './version.ts';

describe('version', () => {
  it('matches package.json', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8')
    ) as { name: string; version: string; bin: Record<string, string> };
    expect(manifest.version).toBe(CLI_VERSION);
    expect(manifest.name).toBe(PACKAGE_NAME);
    expect(manifest.bin['meter']).toBe('./dist/bin.js');
  });
});
