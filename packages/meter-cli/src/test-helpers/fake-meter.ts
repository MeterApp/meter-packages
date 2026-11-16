/**
 * In-process stand-in for www.meterapp.co + the Supabase OAuth 2.1 server:
 * RFC 9728 resource metadata, RFC 8414 AS metadata, RFC 7591 registration,
 * PKCE-verified code exchange, refresh, and a JSON-RPC MCP endpoint.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

export interface FakeMeterOptions {
  /** Disable dynamic registration (no registration_endpoint). */
  registration?: boolean;
  /** Serve AS metadata only at the RFC 8414 path-inserted URL. */
  rfc8414Only?: boolean;
  /** Extra tools advertised by tools/list beyond whoami/list_trips/get_booking. */
  extraTools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  accessTokenTtlSeconds?: number;
  /** Serve AS metadata with this `issuer` value instead of the real one (RFC 8414 check). */
  issuerOverride?: string;
}

export interface FakeMeter {
  origin: string;
  issuer: string;
  server: Server;
  tokens: Set<string>;
  refreshTokens: Map<string, string>;
  registrations: Array<Record<string, unknown>>;
  /** tools/call invocations received (name + arguments). */
  calls: Array<{
    /** The MCP server path the call arrived on. */
    path: string;
    name: string;
    args: Record<string, unknown>;
    token: string;
    userAgent: string | undefined;
  }>;
  authorizeRequests: URL[];
  /** Simulates the human approving in the browser: follows the authorization URL and hits the redirect. */
  approve(authorizationUrl: string): Promise<void>;
  issueToken(): string;
  close(): Promise<void>;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function json(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "x-request-id": "req_test",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

const WHOAMI = {
  profile: {
    id: "user_1",
    first_name: "Ada",
    last_name: "Driver",
    email: "ada@example.com",
    phone: null,
  },
  fleets: [
    {
      fleet_id: "11111111-1111-4111-8111-111111111111",
      name: "Test Fleet",
      role: "admin",
      operational: true,
    },
  ],
  is_rider: false,
  can_read: ["own trips"],
  suggested_next_tools: ["list_fleets"],
};

export async function startFakeMeter(
  options: FakeMeterOptions = {},
): Promise<FakeMeter> {
  const tokens = new Set<string>();
  const refreshTokens = new Map<string, string>();
  const registrations: Array<Record<string, unknown>> = [];
  const calls: FakeMeter["calls"] = [];
  const authorizeRequests: URL[] = [];
  const codes = new Map<
    string,
    { challenge: string; redirectUri: string; clientId: string }
  >();
  const clients = new Map<string, string[]>();
  let origin = "";
  let issuer = "";

  const issueToken = () => {
    const token = `tok_${randomBytes(8).toString("hex")}`;
    tokens.add(token);
    return token;
  };

  const tokenResponse = () => {
    const access = issueToken();
    const refresh = `rt_${randomBytes(8).toString("hex")}`;
    refreshTokens.set(refresh, access);
    return {
      access_token: access,
      token_type: "bearer",
      expires_in: options.accessTokenTtlSeconds ?? 3600,
      refresh_token: refresh,
      scope: "openid email profile",
    };
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", origin);
    const path = url.pathname;

    if (path === "/" && request.method === "HEAD") {
      response.writeHead(200).end();
      return;
    }
    // Like the backend: each server's metadata at its suffix, and the bare
    // path (read by older `meter login` releases) naming the fleet server.
    const metadataResource = {
      "/.well-known/oauth-protected-resource": "/api/mcp/fleet",
      "/.well-known/oauth-protected-resource/api/mcp/fleet": "/api/mcp/fleet",
      "/.well-known/oauth-protected-resource/api/mcp/rider": "/api/mcp/rider",
    }[path];
    if (metadataResource) {
      json(response, 200, {
        resource: `${origin}${metadataResource}`,
        authorization_servers: [issuer],
        bearer_methods_supported: ["header"],
        scopes_supported: ["openid", "email", "profile"],
        resource_name: "Meter MCP",
      });
      return;
    }
    if (path === "/api/mcp") {
      json(response, 410, {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "This Meter MCP server address has been removed.",
        },
      });
      return;
    }
    const metadataPaths = options.rfc8414Only
      ? ["/.well-known/oauth-authorization-server/auth/v1"]
      : ["/auth/v1/.well-known/oauth-authorization-server"];
    if (metadataPaths.includes(path)) {
      const metadata: Record<string, unknown> = {
        issuer: options.issuerOverride ?? issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        code_challenge_methods_supported: ["S256"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        response_types_supported: ["code"],
        scopes_supported: ["openid", "email", "profile"],
      };
      if (options.registration !== false)
        metadata["registration_endpoint"] = `${issuer}/oauth/clients/register`;
      json(response, 200, metadata);
      return;
    }
    if (
      path === "/auth/v1/oauth/clients/register" &&
      request.method === "POST"
    ) {
      if (options.registration === false) {
        json(response, 404, { error: "not_found" });
        return;
      }
      const body = JSON.parse(await readBody(request)) as Record<
        string,
        unknown
      >;
      registrations.push(body);
      const clientId = `client_${registrations.length}`;
      clients.set(clientId, (body["redirect_uris"] as string[]) ?? []);
      json(response, 201, {
        client_id: clientId,
        client_name: body["client_name"],
        redirect_uris: body["redirect_uris"],
        token_endpoint_auth_method: "none",
      });
      return;
    }
    if (path === "/auth/v1/oauth/authorize" && request.method === "GET") {
      authorizeRequests.push(url);
      const clientId = url.searchParams.get("client_id") ?? "";
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      const challenge = url.searchParams.get("code_challenge") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const registered = clients.get(clientId);
      if (registered && !registered.includes(redirectUri)) {
        json(response, 400, {
          error: "invalid_request",
          error_description: "redirect_uri not registered",
        });
        return;
      }
      if (
        url.searchParams.get("code_challenge_method") !== "S256" ||
        !challenge
      ) {
        json(response, 400, {
          error: "invalid_request",
          error_description: "PKCE S256 required",
        });
        return;
      }
      const code = `code_${randomBytes(6).toString("hex")}`;
      codes.set(code, { challenge, redirectUri, clientId });
      const target = new URL(redirectUri);
      target.searchParams.set("code", code);
      target.searchParams.set("state", state);
      response.writeHead(302, { Location: target.toString() }).end();
      return;
    }
    if (path === "/auth/v1/oauth/token" && request.method === "POST") {
      const form = new URLSearchParams(await readBody(request));
      const grant = form.get("grant_type");
      if (grant === "authorization_code") {
        const entry = codes.get(form.get("code") ?? "");
        const verifier = form.get("code_verifier") ?? "";
        const expected = createHash("sha256")
          .update(verifier, "ascii")
          .digest("base64url");
        if (
          !entry ||
          entry.challenge !== expected ||
          entry.redirectUri !== form.get("redirect_uri") ||
          entry.clientId !== form.get("client_id")
        ) {
          json(response, 400, {
            error: "invalid_grant",
            error_description:
              "code, verifier, redirect_uri or client_id mismatch",
          });
          return;
        }
        codes.delete(form.get("code") ?? "");
        json(response, 200, tokenResponse());
        return;
      }
      if (grant === "refresh_token") {
        const previous = refreshTokens.get(form.get("refresh_token") ?? "");
        if (!previous) {
          json(response, 400, {
            error: "invalid_grant",
            error_description: "unknown refresh token",
          });
          return;
        }
        tokens.delete(previous);
        refreshTokens.delete(form.get("refresh_token") ?? "");
        json(response, 200, tokenResponse());
        return;
      }
      json(response, 400, { error: "unsupported_grant_type" });
      return;
    }
    if (["/api/mcp/rider", "/api/mcp/fleet"].includes(path)) {
      if (request.method !== "POST") {
        response.writeHead(405).end();
        return;
      }
      const auth = request.headers.authorization ?? "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const body = JSON.parse(await readBody(request)) as {
        id: number;
        method: string;
        params?: Record<string, unknown>;
      };
      if (!tokens.has(token)) {
        json(
          response,
          401,
          {
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32001, message: "Unauthorized: sign in to Meter" },
          },
          {
            "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource${path}"`,
          },
        );
        return;
      }
      const reply = (result: unknown) =>
        json(response, 200, { jsonrpc: "2.0", id: body.id, result });
      switch (body.method) {
        case "initialize":
          reply({
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "meter", version: "9.9.9" },
            instructions: "REMOTE INSTRUCTIONS",
          });
          return;
        case "tools/list":
          reply({
            tools: [
              {
                name: "whoami",
                description: "who",
                inputSchema: { type: "object", properties: {} },
              },
              {
                name: "list_trips",
                description: "trips",
                inputSchema: {
                  type: "object",
                  properties: { limit: { type: "integer" } },
                },
              },
              ...(options.extraTools ?? []),
            ],
          });
          return;
        case "tools/call": {
          const params = body.params ?? {};
          const name = String(params["name"]);
          const args = (params["arguments"] ?? {}) as Record<string, unknown>;
          calls.push({
            path,
            name,
            args,
            token,
            userAgent: request.headers["user-agent"],
          });
          if (name === "whoami") {
            reply({
              content: [
                {
                  type: "text",
                  text: `${JSON.stringify(WHOAMI)}\n\nNext: call list_fleets.`,
                },
              ],
              structuredContent: WHOAMI,
            });
            return;
          }
          if (name === "list_trips") {
            const page = {
              items: [
                {
                  trip_id: "t1",
                  started_at: "2026-09-01T10:00:00Z",
                  distance_meters: 4200,
                  total_minor: 1850,
                  pickup: { address: "1 Main St" },
                  is_paid: true,
                },
                {
                  trip_id: "t2",
                  started_at: "2026-09-02T11:00:00Z",
                  distance_meters: 900,
                  total_minor: null,
                  pickup: { address: "2 Side St" },
                  is_paid: false,
                },
              ],
              next_cursor: args["cursor"] ? null : "cursor-2",
            };
            reply({
              content: [{ type: "text", text: JSON.stringify(page) }],
              structuredContent: page,
            });
            return;
          }
          if (name === "export_data") {
            // Two CSV chunks; only the first carries the header row.
            const first = !args["cursor"];
            const chunk = {
              dataset: args["dataset"],
              filename: `${String(args["dataset"])}.csv`,
              format: "csv",
              row_count: first ? 2 : 1,
              columns: ["trip_id", "total_decimal"],
              data: first
                ? "trip_id,total_decimal\nt1,18.50\nt2,9.00\n"
                : "t3,4.25\n",
              truncated: first,
              next_cursor: first ? "export-2" : null,
            };
            reply({
              content: [{ type: "text", text: JSON.stringify(chunk) }],
              structuredContent: chunk,
            });
            return;
          }
          if (name === "get_booking") {
            const error = {
              error: `Booking ${String(args["booking_id"])} not found`,
              code: "not_found",
            };
            reply({
              isError: true,
              content: [
                {
                  type: "text",
                  text: `${error.error}\n\nNext: take ids from list_bookings.`,
                },
              ],
              structuredContent: error,
            });
            return;
          }
          const echo = { tool: name, received: args };
          reply({
            content: [{ type: "text", text: JSON.stringify(echo) }],
            structuredContent: echo,
          });
          return;
        }
        default:
          json(response, 200, {
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32601,
              message: `Method not found: ${body.method}`,
            },
          });
      }
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  origin = `http://127.0.0.1:${port}`;
  issuer = `${origin}/auth/v1`;

  return {
    origin,
    issuer,
    server,
    tokens,
    refreshTokens,
    registrations,
    calls,
    authorizeRequests,
    async approve(authorizationUrl: string) {
      const authorize = await fetch(authorizationUrl, { redirect: "manual" });
      const location = authorize.headers.get("location");
      if (!location)
        throw new Error(
          `authorize did not redirect: ${authorize.status} ${await authorize.text()}`,
        );
      const callback = await fetch(location);
      if (!callback.ok) throw new Error(`callback failed: ${callback.status}`);
    },
    issueToken,
    close() {
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}

/** Captured stdout/stderr for `main()` tests. */
export function captureIo(options: { json?: boolean } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: {
      stdout: (text: string) => {
        out.push(text);
      },
      stderr: (text: string) => {
        err.push(text);
      },
      isTTY: false,
      color: false,
      json: options.json ?? false,
      quiet: false,
    },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}
