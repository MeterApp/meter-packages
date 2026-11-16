import { SDK_VERSION } from './version.ts';
/**
 * Minimal MCP JSON-RPC client over Streamable HTTP (JSON response mode), for
 * the Meter CLI and scripts. Zero dependencies; Node 20+ or any fetch runtime.
 *
 * Uses only erasable TypeScript syntax (no parameter properties or enums) so
 * Node's built-in type stripping can load the workspace sources directly.
 */
export interface MeterMcpClientOptions {
  /** e.g. https://www.meterapp.co/api/mcp/fleet */
  url: string;
  /** Supabase access token (OAuth 2.1 access token from the Meter connector flow). */
  accessToken: string;
  fetch?: typeof fetch;
  /** MCP protocol version to negotiate. */
  protocolVersion?: string;
  clientInfo?: { name: string; version: string };
}

export interface JsonRpcErrorShape {
  code: number;
  message: string;
  data?: unknown;
}

export class MeterMcpError extends Error {
  /** HTTP status of the failing response, or null when the request never completed. */
  readonly status: number | null;
  /** JSON-RPC error object when the server answered with one. */
  readonly rpcError: JsonRpcErrorShape | null;
  /** `x-request-id` response header, for support. */
  readonly requestId: string | null;

  constructor(
    message: string,
    status: number | null,
    rpcError: JsonRpcErrorShape | null = null,
    requestId: string | null = null
  ) {
    super(message);
    this.name = 'MeterMcpError';
    this.status = status;
    this.rpcError = rpcError;
    this.requestId = requestId;
  }
}

export interface McpToolDescriptor {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface McpCallToolResult {
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

export class MeterMcpClient {
  private nextId = 1;
  private readonly options: MeterMcpClientOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly protocolVersion: string;
  private readonly clientInfo: { name: string; version: string };

  constructor(options: MeterMcpClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.protocolVersion = options.protocolVersion ?? DEFAULT_PROTOCOL_VERSION;
    this.clientInfo = options.clientInfo ?? {
      name: 'meter-sdk',
      version: SDK_VERSION
    };
  }

  async initialize(): Promise<{
    serverInfo: { name: string; version: string };
    instructions?: string;
    protocolVersion: string;
  }> {
    return this.request('initialize', {
      protocolVersion: this.protocolVersion,
      capabilities: {},
      clientInfo: this.clientInfo
    });
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    const result = await this.request<{ tools: McpToolDescriptor[] }>(
      'tools/list',
      {}
    );
    return result.tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<McpCallToolResult> {
    return this.request<McpCallToolResult>('tools/call', {
      name,
      arguments: args
    });
  }

  async request<T>(
    method: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const id = this.nextId++;
    const response = await this.fetchImpl(this.options.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': this.protocolVersion
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
    });
    const requestId = response.headers.get('x-request-id');
    const text = await response.text();
    const payload = parseRpcPayload(text, response.headers.get('content-type'));
    if (!response.ok && !payload) {
      throw new MeterMcpError(
        `HTTP ${response.status} from ${this.options.url}`,
        response.status,
        null,
        requestId
      );
    }
    if (!payload) {
      throw new MeterMcpError(
        'Empty or non-JSON MCP response',
        response.status,
        null,
        requestId
      );
    }
    if (payload.error) {
      throw new MeterMcpError(
        payload.error.message,
        response.status,
        payload.error,
        requestId
      );
    }
    return payload.result as T;
  }
}

/** Accepts plain JSON or a single-message SSE body. */
function parseRpcPayload(
  text: string,
  contentType: string | null
): { result?: unknown; error?: JsonRpcErrorShape } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (contentType?.includes('text/event-stream')) {
    const data = trimmed
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .pop();
    return data
      ? (JSON.parse(data) as { result?: unknown; error?: JsonRpcErrorShape })
      : null;
  }
  try {
    return JSON.parse(trimmed) as {
      result?: unknown;
      error?: JsonRpcErrorShape;
    };
  } catch {
    return null;
  }
}
