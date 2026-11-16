import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { main } from '../main.ts';
import {
  captureIo,
  startFakeMeter,
  type FakeMeter
} from '../test-helpers/fake-meter.ts';
let fake: FakeMeter, dir: string, env: Record<string, string>;
const item = '11111111-1111-4111-8111-111111111111';
const key = '22222222-2222-4222-8222-222222222222';
const proposal = '33333333-3333-4333-8333-333333333333';
beforeEach(async () => {
  fake = await startFakeMeter();
  dir = await mkdtemp(join(tmpdir(), 'meter-feedback-'));
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
it.each([
  [['ideas'], 'list_ideas', {}],
  [
    [
      'ideas',
      'list',
      '--query',
      'route',
      '--sort',
      'trending',
      '--cursor',
      'next'
    ],
    'list_ideas',
    { query: 'route', sort: 'trending', cursor: 'next' }
  ],
  [
    [
      'ideas',
      'search',
      '--title',
      'Route reminders',
      '--details',
      'A useful suggestion'
    ],
    'find_similar_ideas',
    { title: 'Route reminders', details: 'A useful suggestion' }
  ],
  [['ideas', 'get', item], 'get_feedback_item', { item_id: item }],
  [['feedback'], 'list_my_feedback', {}],
  [
    ['feedback', 'list', '--scope', 'fleet', '--limit', '3'],
    'list_my_feedback',
    { scope: 'fleet', limit: 3 }
  ],
  [['feedback', 'get', item], 'get_feedback_item', { item_id: item }],
  [['changelog'], 'list_changelog', {}],
  [
    ['changelog', 'list', '--limit', '1', '--cursor', 'next'],
    'list_changelog',
    { limit: 1, cursor: 'next' }
  ]
] as const)('dispatches %j to %s', async (argv, name, args) => {
  const io = captureIo({ json: true });
  expect(await main([...argv, '--json'], { env, io: io.io })).toBe(0);
  expect(fake.calls).toHaveLength(1);
  expect(fake.calls[0]).toMatchObject({ name, args });
  expect(fake.calls[0]!.userAgent).toMatch(/^meter-cli\//);
  expect(JSON.parse(io.stdout())).toMatchObject({ tool: name, received: args });
});
it.each([
  ['ideas', 'vote', item, '--voted', 'true'],
  ['feedback', 'follow', item, '--following', 'false'],
  [
    'feedback',
    'comment',
    item,
    '--body',
    'Complete comment',
    '--idempotency-key',
    key
  ],
  [
    'feedback',
    'submit',
    '--type',
    'idea',
    '--title',
    'Full idea title',
    '--body',
    'Complete idea details',
    '--category',
    'other',
    '--idempotency-key',
    key
  ]
])(
  'preserves %j preview intent, explicit confirmation and an identical retry',
  async (...argv) => {
    const preview = captureIo({ json: true });
    expect(
      await main([...argv, '--dry-run', '--json'], { env, io: preview.io })
    ).toBe(0);
    const call = fake.calls[0]!;
    expect(call.args['dry_run']).toBe(true);
    expect(call.args).not.toHaveProperty('surface');
    expect(call.args).not.toHaveProperty('actor_id');
    for (let i = 0; i < 2; i++) {
      const confirm = captureIo({ json: true });
      expect(
        await main([...argv, '--proposal-id', proposal, '--json'], {
          env,
          io: confirm.io
        })
      ).toBe(0);
      expect(fake.calls.at(-1)).toMatchObject({
        name: call.name,
        args: { ...call.args, dry_run: false, proposal_id: proposal }
      });
    }
    expect(fake.calls).toHaveLength(3);
  }
);
it('passes complete private report context as JSON without inferring actor or attribution', async () => {
  const body = 'x'.repeat(5000);
  const io = captureIo({ json: true });
  expect(
    await main(
      [
        'feedback',
        'submit',
        '--args',
        JSON.stringify({
          type: 'issue',
          body,
          category: 'other',
          subject: { type: 'screen', id: 'meter' },
          idempotency_key: key
        }),
        '--dry-run',
        '--json'
      ],
      { env, io: io.io }
    )
  ).toBe(0);
  expect(fake.calls[0]!.args).toMatchObject({
    body,
    subject: { type: 'screen', id: 'meter' },
    idempotency_key: key,
    dry_run: true
  });
});
it('rejects unknown subcommands, extra ids, invalid booleans and private idea context before HTTP dispatch', async () => {
  for (const argv of [
    ['feedback', 'delete', item],
    ['ideas', 'get', item, item],
    ['ideas', 'vote', item, '--voted', 'maybe'],
    [
      'feedback',
      'submit',
      '--args',
      JSON.stringify({
        type: 'idea',
        title: 'Idea title',
        body: 'Complete details',
        category: 'other',
        subject: { type: 'screen', id: 'meter' },
        idempotency_key: key
      })
    ],
    ['feedback', 'comment', item, '--body', 'Comment without a key']
  ]) {
    const io = captureIo();
    expect(await main(argv, { env, io: io.io })).toBe(2);
    expect(io.stderr()).not.toBe('');
  }
  expect(fake.calls).toEqual([]);
});
it('shows every alias and shared preview/confirmation fields in offline help', async () => {
  for (const command of ['ideas', 'feedback', 'changelog']) {
    const io = captureIo();
    expect(await main(['help', command], { env: {}, io: io.io })).toBe(0);
    expect(io.stdout()).toContain(`meter ${command}`);
  }
  const io = captureIo();
  expect(
    await main(['feedback', 'submit', '--help'], { env: {}, io: io.io })
  ).toBe(0);
  expect(io.stdout()).toContain('dry_run');
  expect(io.stdout()).toContain('--proposal-id');
  expect(io.stdout()).toContain('--idempotency-key');
  expect(fake.calls).toEqual([]);
});

it('reports authentication failure through the shared command exit and error path', async () => {
  const io = captureIo();
  expect(
    await main(
      ['feedback', 'follow', item, '--following', 'true', '--dry-run'],
      { env: { ...env, METER_ACCESS_TOKEN: 'expired' }, io: io.io }
    )
  ).toBe(1);
  expect(io.stderr()).toContain('meter login');
  expect(fake.calls).toEqual([]);
});
