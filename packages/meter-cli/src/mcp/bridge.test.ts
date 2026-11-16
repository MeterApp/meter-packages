import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClientContext } from '../client.ts';
import { startFakeMeter, type FakeMeter } from '../test-helpers/fake-meter.ts';
import { createBridge, type JsonRpcResponse } from './bridge.ts';

let fake: FakeMeter;
let env: Record<string, string>;

beforeEach(async () => {
  fake = await startFakeMeter();
  env = {
    METER_API_ORIGIN: fake.origin,
    METER_ACCESS_TOKEN: fake.issueToken(),
    METER_CONFIG_DIR: '/nonexistent/meter'
  };
});
afterEach(async () => {
  await fake.close();
});

describe('stdio bridge (in-process)', () => {
  it('proxies initialize, tools/list and tools/call to the remote server', async () => {
    const context = createClientContext({}, env, { kind: 'mcp' });
    const bridge = createBridge({ client: () => context.client() });
    const init = (await bridge.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' }
      }
    })) as JsonRpcResponse;
    expect(init.result).toMatchObject({
      protocolVersion: '2025-03-26',
      serverInfo: { name: 'meter', version: '9.9.9' },
      instructions: 'REMOTE INSTRUCTIONS',
      capabilities: { tools: {} }
    });
    expect(
      await bridge.handle({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      })
    ).toBeNull();
    const list = (await bridge.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    })) as JsonRpcResponse;
    expect(
      (list.result as { tools: Array<{ name: string }> }).tools.map(
        (tool) => tool.name
      )
    ).toEqual(['whoami', 'list_trips']);
    const call = (await bridge.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_trips', arguments: { limit: 1 } }
    })) as JsonRpcResponse;
    expect(
      (call.result as { structuredContent: { items: unknown[] } })
        .structuredContent.items
    ).toHaveLength(2);
    expect(fake.calls[0]).toMatchObject({
      name: 'list_trips',
      args: { limit: 1 },
      token: env['METER_ACCESS_TOKEN']
    });
    const ping = (await bridge.handle({
      jsonrpc: '2.0',
      id: 4,
      method: 'ping'
    })) as JsonRpcResponse;
    expect(ping.result).toEqual({});
    const unknown = (await bridge.handle({
      jsonrpc: '2.0',
      id: 5,
      method: 'resources/list'
    })) as JsonRpcResponse;
    expect(unknown.error?.code).toBe(-32601);
  });

  it('serves the built-in catalog and isError results when there is no session', async () => {
    const context = createClientContext(
      {},
      {
        METER_API_ORIGIN: fake.origin,
        METER_CONFIG_DIR: '/nonexistent/meter',
        HOME: '/nonexistent'
      },
      { kind: 'mcp' }
    );
    const logs: string[] = [];
    const bridge = createBridge({
      client: () => context.client(),
      log: (line) => logs.push(line)
    });
    const init = (await bridge.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18' }
    })) as JsonRpcResponse;
    expect((init.result as { instructions: string }).instructions).toMatch(
      /Meter is the taxi meter/
    );
    const list = (await bridge.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    })) as JsonRpcResponse;
    const names = (
      list.result as {
        tools: Array<{ name: string; inputSchema: { type: string } }>;
      }
    ).tools;
    expect(names.map((tool) => tool.name)).toContain('get_accounting_summary');
    expect(names[0]?.inputSchema.type).toBe('object');
    const call = (await bridge.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'whoami', arguments: {} }
    })) as JsonRpcResponse;
    expect(call.result).toMatchObject({
      isError: true,
      structuredContent: { code: 'unauthenticated' }
    });
    expect(logs.join('')).toMatch(/remote initialize failed/);
  });
});

const binPath = fileURLToPath(new URL('../../dist/bin.js', import.meta.url));

describe.skipIf(!existsSync(binPath))('stdio bridge (spawned binary)', () => {
  it('speaks newline-delimited JSON-RPC over stdio', async () => {
    const child = spawn(process.execPath, [binPath, 'mcp'], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const replies: JsonRpcResponse[] = [];
    const stderr: string[] = [];
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
    const lines = createInterface({ input: child.stdout });
    const waitFor = (count: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`timed out; stderr: ${stderr.join('')}`)),
          15000
        );
        lines.on('line', (line) => {
          replies.push(JSON.parse(line) as JsonRpcResponse);
          if (replies.length >= count) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    const done = waitFor(3);
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'spawn-test', version: '0' } } })}\n`
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'whoami', arguments: {} } })}\n`
    );
    await done;
    child.stdin.end();
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    expect(replies[0]?.result).toMatchObject({
      instructions: 'REMOTE INSTRUCTIONS'
    });
    expect((replies[1]?.result as { tools: unknown[] }).tools).toHaveLength(2);
    expect(
      (
        replies[2]?.result as {
          structuredContent: { profile: { email: string } };
        }
      ).structuredContent.profile.email
    ).toBe('ada@example.com');
  });
});
