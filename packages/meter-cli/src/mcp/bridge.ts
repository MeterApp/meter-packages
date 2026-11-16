/**
 * Stdio MCP server that proxies to the remote Meter MCP endpoint. Tool logic is
 * never duplicated here: `tools/list` and `tools/call` are forwarded with the
 * stored session token, and the remote `instructions` are passed through on
 * `initialize`. Hosts that cannot do OAuth themselves (or that run in CI with
 * METER_ACCESS_TOKEN) get the same tools as the remote server.
 */
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import {
  MeterMcpClient,
  MeterMcpError,
  type McpCallToolResult,
  type McpToolDescriptor
} from '@meterapp/meter-sdk/client';
import {
  MCP_INSTRUCTIONS,
  MCP_SERVER_INFO,
  MCP_TOOL_LIST,
  nextStepFor,
  type McpToolDefinition
} from '@meterapp/meter-sdk/mcp';
import * as z from 'zod';
import { CLI_VERSION } from '../version.ts';

export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2024-11-05',
  '2025-03-26',
  '2025-06-18'
] as const;
export const LATEST_PROTOCOL_VERSION = '2025-06-18';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface BridgeDeps {
  /** Resolves the remote client; may throw a CliError when no session exists. */
  client(): Promise<MeterMcpClient>;
  log?(line: string): void;
}

export interface Bridge {
  /** Handles one incoming message; returns null for notifications. */
  handle(message: unknown): Promise<JsonRpcResponse | null>;
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

function response(
  id: number | string | null,
  result: unknown
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function failure(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  const error: JsonRpcResponse['error'] = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/** Local fallback catalog for hosts that list tools before the human signed in. */
export function catalogDescriptors(): McpToolDescriptor[] {
  return MCP_TOOL_LIST.map((tool: McpToolDefinition) => {
    const descriptor: McpToolDescriptor = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
      annotations: { title: tool.title, ...tool.annotations }
    };
    if (tool.outputSchema)
      descriptor.outputSchema = z.toJSONSchema(tool.outputSchema) as Record<
        string,
        unknown
      >;
    return descriptor;
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Converts a transport/auth failure into an `isError` tool result the agent can act on. */
export function toolErrorFromException(error: unknown): McpCallToolResult {
  const unauthenticated =
    error instanceof MeterMcpError
      ? error.status === 401
      : /Not signed in/i.test(errorMessage(error));
  const code = unauthenticated
    ? 'unauthenticated'
    : error instanceof MeterMcpError && error.status === 403
      ? 'forbidden'
      : 'internal_error';
  const message = unauthenticated
    ? 'No Meter session: run `meter login` on this machine (or set METER_ACCESS_TOKEN) and retry.'
    : errorMessage(error);
  const structured: Record<string, unknown> = { error: message, code };
  if (error instanceof MeterMcpError) {
    if (error.status !== null) structured['status'] = error.status;
    if (error.requestId) structured['request_id'] = error.requestId;
  }
  return {
    isError: true,
    content: [
      { type: 'text', text: `${message}\n\nNext: ${nextStepFor(code)}` }
    ],
    structuredContent: structured
  };
}

export function createBridge(deps: BridgeDeps): Bridge {
  let remote: {
    serverInfo: { name: string; version: string };
    instructions?: string;
  } | null = null;

  const remoteInitialize = async () => {
    if (remote) return remote;
    const client = await deps.client();
    remote = await client.initialize();
    return remote;
  };

  return {
    async handle(message: unknown): Promise<JsonRpcResponse | null> {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return failure(
          null,
          INVALID_REQUEST,
          'Expected a JSON-RPC 2.0 request object'
        );
      }
      const request = message as Partial<JsonRpcRequest>;
      if (typeof request.method !== 'string') {
        // A response to a server-initiated request; the bridge never sends any, so ignore it.
        return request.id === undefined
          ? null
          : failure(request.id ?? null, INVALID_REQUEST, 'Missing method');
      }
      const id = request.id ?? null;
      const isNotification = request.id === undefined;
      const params = (request.params ?? {}) as Record<string, unknown>;

      try {
        switch (request.method) {
          case 'initialize': {
            const requested =
              typeof params['protocolVersion'] === 'string'
                ? params['protocolVersion']
                : LATEST_PROTOCOL_VERSION;
            const protocolVersion = (
              SUPPORTED_PROTOCOL_VERSIONS as readonly string[]
            ).includes(requested)
              ? requested
              : LATEST_PROTOCOL_VERSION;
            let serverInfo: { name: string; version: string; title?: string } =
              {
                name: MCP_SERVER_INFO.name,
                title: MCP_SERVER_INFO.title,
                version: CLI_VERSION
              };
            let instructions = MCP_INSTRUCTIONS;
            try {
              const info = await remoteInitialize();
              serverInfo = { ...serverInfo, ...info.serverInfo };
              if (info.instructions) instructions = info.instructions;
            } catch (error) {
              deps.log?.(
                `meter mcp: remote initialize failed (${errorMessage(error)}); tools will report an error until \`meter login\` succeeds.\n`
              );
            }
            return response(id, {
              protocolVersion,
              capabilities: { tools: {} },
              serverInfo,
              instructions
            });
          }
          case 'ping':
            return response(id, {});
          case 'tools/list': {
            try {
              const client = await deps.client();
              const tools = await client.listTools();
              return response(id, { tools });
            } catch (error) {
              deps.log?.(
                `meter mcp: tools/list from the remote failed (${errorMessage(error)}); serving the built-in catalog.\n`
              );
              return response(id, { tools: catalogDescriptors() });
            }
          }
          case 'tools/call': {
            const name = params['name'];
            if (typeof name !== 'string' || !name)
              return failure(
                id,
                INVALID_REQUEST,
                'tools/call requires params.name'
              );
            const args = (params['arguments'] ?? {}) as Record<string, unknown>;
            try {
              const client = await deps.client();
              const result = await client.callTool(name, args);
              return response(id, result);
            } catch (error) {
              if (
                error instanceof MeterMcpError &&
                error.rpcError &&
                error.status !== 401 &&
                error.status !== 403
              ) {
                return failure(
                  id,
                  error.rpcError.code,
                  error.rpcError.message,
                  error.rpcError.data
                );
              }
              return response(id, toolErrorFromException(error));
            }
          }
          default:
            if (request.method.startsWith('notifications/')) return null;
            if (isNotification) return null;
            return failure(
              id,
              METHOD_NOT_FOUND,
              `Method not found: ${request.method}`
            );
        }
      } catch (error) {
        if (isNotification) return null;
        return failure(id, INTERNAL_ERROR, errorMessage(error));
      }
    }
  };
}

export interface StdioOptions {
  input?: Readable;
  output?: Writable;
  log?(line: string): void;
}

/** Serves newline-delimited JSON-RPC over stdio until the input ends. */
export function serveStdio(
  bridge: Bridge,
  options: StdioOptions = {}
): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const log = options.log ?? ((line: string) => process.stderr.write(line));
  return new Promise((resolve) => {
    const reader = createInterface({
      input,
      crlfDelay: Number.POSITIVE_INFINITY
    });
    let pending = 0;
    let ended = false;
    const finish = () => {
      if (ended && pending === 0) resolve();
    };
    const write = (message: JsonRpcResponse) => {
      output.write(`${JSON.stringify(message)}\n`);
    };
    reader.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        write(failure(null, PARSE_ERROR, 'Parse error'));
        return;
      }
      pending += 1;
      bridge
        .handle(parsed)
        .then((reply) => {
          if (reply) write(reply);
        })
        .catch((error: unknown) => {
          log(`meter mcp: ${errorMessage(error)}\n`);
        })
        .finally(() => {
          pending -= 1;
          finish();
        });
    });
    reader.once('close', () => {
      ended = true;
      finish();
    });
  });
}
