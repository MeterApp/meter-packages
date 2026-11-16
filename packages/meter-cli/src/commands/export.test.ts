import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MCP_TOOL_NAMES } from '@meterapp/meter-sdk/mcp';
import { main } from '../main.ts';
import {
  captureIo,
  startFakeMeter,
  type FakeMeter
} from '../test-helpers/fake-meter.ts';
import { ALIASES } from './call.ts';

let fake: FakeMeter;
let dir: string;
let env: Record<string, string>;

beforeEach(async () => {
  fake = await startFakeMeter();
  dir = await mkdtemp(join(tmpdir(), 'meter-export-'));
  env = {
    METER_CONFIG_DIR: dir,
    METER_API_ORIGIN: fake.origin,
    METER_ACCESS_TOKEN: fake.issueToken(),
    HOME: dir
  };
});
afterEach(async () => {
  await fake.close();
  await rm(dir, { recursive: true, force: true });
});

describe('meter export', () => {
  it('pages export_data to the end and writes one CSV with one header', async () => {
    const captured = captureIo();
    expect(
      await main(
        ['export', 'trips', '--from', '2026-09-01', '--out', 'sept.csv'],
        { env, io: captured.io, cwd: dir }
      )
    ).toBe(0);
    expect(await readFile(join(dir, 'sept.csv'), 'utf8')).toBe(
      'trip_id,total_decimal\nt1,18.50\nt2,9.00\nt3,4.25\n'
    );
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]!.args).toMatchObject({
      dataset: 'trips',
      from: '2026-09-01'
    });
    expect(fake.calls[0]!.args).not.toHaveProperty('cursor');
    expect(fake.calls[1]!.args).toMatchObject({
      dataset: 'trips',
      from: '2026-09-01',
      cursor: 'export-2'
    });
    expect(captured.stdout()).toMatch(/Wrote 3 rows/);
  });

  it('prints to stdout with --out -', async () => {
    const captured = captureIo();
    expect(
      await main(['export', 'trips', '--out', '-'], { env, io: captured.io })
    ).toBe(0);
    expect(captured.stdout()).toBe(
      'trip_id,total_decimal\nt1,18.50\nt2,9.00\nt3,4.25\n'
    );
  });

  it('requires a dataset', async () => {
    const captured = captureIo();
    expect(await main(['export'], { env, io: captured.io })).toBe(2);
    expect(fake.calls).toEqual([]);
  });
});

describe('aliases', () => {
  it('only name tools in the catalog', () => {
    for (const [group, spec] of Object.entries(ALIASES))
      for (const [sub, alias] of Object.entries(spec.subcommands))
        expect(MCP_TOOL_NAMES, `${group} ${sub}`).toContain(alias.tool);
  });
});
