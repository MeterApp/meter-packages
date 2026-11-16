import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../main.ts';
import {
  captureIo,
  startFakeMeter,
  type FakeMeter
} from '../test-helpers/fake-meter.ts';

let fake: FakeMeter;
let dir: string;
let env: Record<string, string>;

beforeEach(async () => {
  fake = await startFakeMeter({
    extraTools: [
      {
        name: 'remote_only_settings',
        description: 'write tool added server-side',
        inputSchema: {
          type: 'object',
          properties: {
            fleet_id: { type: 'string' },
            dispatch_mode: { type: 'string', enum: ['auto', 'manual'] },
            lead_minutes: { type: 'integer' },
            dry_run: { type: 'boolean' }
          },
          required: ['fleet_id']
        }
      }
    ]
  });
  dir = await mkdtemp(join(tmpdir(), 'meter-call-'));
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

describe('meter call and aliases', () => {
  it('calls whoami and renders a readable summary', async () => {
    const captured = captureIo();
    expect(await main(['whoami'], { env, io: captured.io })).toBe(0);
    const out = captured.stdout();
    expect(out).toMatch(/profile.email\s+ada@example.com/);
    expect(out).toMatch(/Test Fleet/);
    expect(out).toMatch(/Token\s+env/);
    expect(fake.calls.map((call) => call.name)).toEqual(['whoami']);
  });

  it('renders pages as tables and passes coerced arguments', async () => {
    const captured = captureIo();
    expect(
      await main(
        [
          'trips',
          'list',
          '--driver',
          'all',
          '--limit',
          '2',
          '--start-date',
          '2026-09-01'
        ],
        { env, io: captured.io }
      )
    ).toBe(0);
    expect(fake.calls[0]).toMatchObject({
      name: 'list_trips',
      args: { driver: 'all', limit: 2, start_date: '2026-09-01' }
    });
    const out = captured.stdout();
    expect(out).toMatch(
      /trip_id\s+started_at\s+distance_meters\s+total_minor\s+pickup.address\s+is_paid/
    );
    expect(out).toMatch(/t1 .*1850 .*1 Main St .*yes/);
    expect(out).toMatch(/2 items · more: pass --cursor cursor-2/);
  });

  it('prints raw structured output with --json', async () => {
    const captured = captureIo({ json: true });
    expect(
      await main(['call', 'list_trips', '--json'], { env, io: captured.io })
    ).toBe(0);
    const parsed = JSON.parse(captured.stdout()) as {
      items: unknown[];
      next_cursor: string;
    };
    expect(parsed.items).toHaveLength(2);
    expect(parsed.next_cursor).toBe('cursor-2');
  });

  it('maps alias positionals onto ids and reports tool errors with exit 1', async () => {
    const captured = captureIo();
    expect(
      await main(['bookings', 'get', '33333333-3333-4333-8333-333333333333'], {
        env,
        io: captured.io
      })
    ).toBe(1);
    expect(fake.calls[0]).toMatchObject({
      name: 'get_booking',
      args: { booking_id: '33333333-3333-4333-8333-333333333333' }
    });
    expect(captured.stderr()).toMatch(
      /get_booking \[not_found\]: Booking .* not found/
    );
    expect(captured.stderr()).toMatch(/take ids from list_bookings/);
  });

  it('maps rides aliases onto the rider ride tools, with text or JSON locations', async () => {
    const captured = captureIo({ json: true });
    await main(['rides', 'places', 'JFK Terminal 4'], {
      env,
      io: captured.io
    });
    await main(
      [
        'rides',
        'request',
        '--fleet-id',
        '11111111-1111-4111-8111-111111111111',
        '--pickup',
        '{"latitude":40.71,"longitude":-74.0}',
        '--dropoff',
        'JFK Terminal 4',
        '--dry-run'
      ],
      { env, io: captured.io }
    );
    expect(fake.calls.slice(-2)).toMatchObject([
      {
        path: '/api/mcp/rider',
        name: 'search_places',
        args: { query: 'JFK Terminal 4' }
      },
      {
        path: '/api/mcp/rider',
        name: 'request_ride',
        args: {
          fleet_id: '11111111-1111-4111-8111-111111111111',
          pickup: { latitude: 40.71, longitude: -74 },
          dropoff: 'JFK Terminal 4',
          dry_run: true
        }
      }
    ]);
  });

  it('calls tools unknown to this CLI build using the remote schema, with --dry-run', async () => {
    const captured = captureIo({ json: true });
    expect(
      await main(
        [
          'call',
          'remote_only_settings',
          '--fleet-id',
          'f1',
          '--dispatch-mode',
          'manual',
          '--lead-minutes',
          '15',
          '--dry-run',
          '--json'
        ],
        { env, io: captured.io }
      )
    ).toBe(0);
    expect(fake.calls.at(-1)).toMatchObject({
      name: 'remote_only_settings',
      args: {
        fleet_id: 'f1',
        dispatch_mode: 'manual',
        lead_minutes: 15,
        dry_run: true
      }
    });
    const bad = captureIo();
    expect(
      await main(
        [
          'call',
          'remote_only_settings',
          '--fleet-id',
          'f1',
          '--dispatch-mode',
          'sideways'
        ],
        { env, io: bad.io }
      )
    ).toBe(2);
    expect(bad.stderr()).toMatch(/Choose one of: auto, manual/);
  });

  it('lists available tools for an unknown name', async () => {
    const captured = captureIo();
    expect(await main(['call', 'nope'], { env, io: captured.io })).toBe(2);
    expect(captured.stderr()).toMatch(/Unknown tool "nope"/);
    expect(captured.stderr()).toMatch(/remote_only_settings/);
  });

  it('explains a 401 with a login hint', async () => {
    const captured = captureIo();
    expect(
      await main(['trips', 'list'], {
        env: { ...env, METER_ACCESS_TOKEN: 'expired' },
        io: captured.io
      })
    ).toBe(1);
    expect(captured.stderr()).toMatch(/Run `meter login`/);
    expect(captured.stderr()).toMatch(/request id: req_test/);
  });

  it('runs doctor against the fake deployment', async () => {
    const captured = captureIo({ json: true });
    expect(await main(['doctor', '--json'], { env, io: captured.io })).toBe(0);
    const report = JSON.parse(captured.stdout()) as {
      ok: boolean;
      checks: Array<{ name: string; status: string }>;
    };
    expect(report.ok).toBe(true);
    expect(
      report.checks.map((check) => `${check.name}:${check.status}`)
    ).toEqual([
      'node:pass',
      'origin:pass',
      'resource-metadata:pass',
      'authorization-server:pass',
      'mcp-endpoint:pass',
      'session:pass',
      'whoami:pass'
    ]);
    const signedOut = captureIo({ json: true });
    const { METER_ACCESS_TOKEN: _omit, ...withoutToken } = env;
    expect(
      await main(['doctor', '--json'], { env: withoutToken, io: signedOut.io })
    ).toBe(1);
    const failing = JSON.parse(signedOut.stdout()) as {
      checks: Array<{ name: string; status: string }>;
    };
    expect(
      failing.checks.find((check) => check.name === 'session')?.status
    ).toBe('fail');
  });

  it('describes and explains without a network', async () => {
    const describe = captureIo({ json: true });
    expect(
      await main(['describe', 'list_trips', '--json'], {
        env: {},
        io: describe.io
      })
    ).toBe(0);
    const [tool] = JSON.parse(describe.stdout()) as Array<{
      name: string;
      input_schema: { properties: Record<string, unknown> };
    }>;
    expect(tool?.name).toBe('list_trips');
    expect(Object.keys(tool?.input_schema.properties ?? {})).toContain('limit');
    const explain = captureIo();
    expect(
      await main(['explain', 'list_trips', 'total_minor'], {
        env: {},
        io: explain.io
      })
    ).toBe(0);
    expect(explain.stdout()).toMatch(/minor currency units/);
    const unknown = captureIo();
    expect(await main(['describe', 'nope'], { env: {}, io: unknown.io })).toBe(
      2
    );
    expect(unknown.stdout()).toMatch(/Unknown tool "nope"/);
  });

  it('writes project MCP config with agent-config --write', async () => {
    const captured = captureIo();
    expect(
      await main(['agent-config', '--host', 'claude-code', '--write'], {
        env: {},
        io: captured.io,
        cwd: dir
      })
    ).toBe(0);
    const file = JSON.parse(
      await readFile(join(dir, '.mcp.json'), 'utf8')
    ) as { mcpServers: Record<string, unknown> };
    expect(file.mcpServers['meter-fleet']).toEqual({
      type: 'http',
      url: 'https://www.meterapp.co/api/mcp/fleet'
    });

    const path = join(dir, '.mcp.json');
    await writeFile(
      path,
      JSON.stringify({
        other: true,
        mcpServers: { github: { type: 'http', url: 'https://x' } }
      }),
      'utf8'
    );
    expect(
      await main(
        ['agent-config', '--host', 'claude-code', '--write', '--local'],
        { env: {}, io: captureIo().io, cwd: dir }
      )
    ).toBe(0);
    const merged = JSON.parse(await readFile(path, 'utf8')) as {
      other: boolean;
      mcpServers: Record<string, unknown>;
    };
    expect(merged.other).toBe(true);
    expect(merged.mcpServers['github']).toEqual({
      type: 'http',
      url: 'https://x'
    });
    expect(merged.mcpServers['meter-fleet']).toMatchObject({ command: 'npx' });

    await writeFile(path, '[]', 'utf8');
    const refused = captureIo();
    expect(
      await main(['agent-config', '--host', 'claude-code', '--write'], {
        env: {},
        io: refused.io,
        cwd: dir
      })
    ).toBe(1);
    expect(refused.stderr()).toMatch(/not a JSON object; refusing/);
    expect(await readFile(path, 'utf8')).toBe('[]');
    await writeFile(path, '{ // comment\n}', 'utf8');
    expect(
      await main(['agent-config', '--host', 'claude-code', '--write'], {
        env: {},
        io: captureIo().io,
        cwd: dir
      })
    ).toBe(1);
    expect(await readFile(path, 'utf8')).toBe('{ // comment\n}');
  });
});
