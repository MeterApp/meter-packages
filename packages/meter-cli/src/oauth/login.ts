import { CliError } from '../errors.ts';
import type { RegisteredClient, StoredCredential } from '../config.ts';
import {
  discover,
  requestSignal,
  type Discovery,
  type FetchLike
} from './discovery.ts';
import { startLoopbackServer, type LoopbackServer } from './loopback.ts';
import { createPkcePair, randomState } from './pkce.ts';

export const CLIENT_NAME = 'Meter CLI';
export const CLIENT_URI = 'https://www.meterapp.co';
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
/** Refresh when the access token expires within this window. */
export const REFRESH_SKEW_MS = 60 * 1000;

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  [key: string]: unknown;
}

export interface LoginDeps {
  fetch: FetchLike;
  origin: string;
  /** Explicit client id (--client-id / METER_OAUTH_CLIENT_ID); skips dynamic registration. */
  clientId?: string;
  readRegisteredClient(issuer: string): Promise<RegisteredClient | null>;
  saveRegisteredClient(
    issuer: string,
    client: Omit<RegisteredClient, 'registered_at'>
  ): Promise<void>;
  /** Show the URL to the human and optionally open the browser. */
  onAuthorizationUrl(url: string): void | Promise<void>;
  now?(): number;
  timeoutMs?: number;
  /** Test hook: replaces the loopback server. */
  startLoopback?(state: string, preferredPort: number): Promise<LoopbackServer>;
}

export interface LoginResult {
  credential: Omit<StoredCredential, 'saved_at'>;
  discovery: Discovery;
  clientId: string;
}

async function postForm(
  fetchImpl: FetchLike,
  url: string,
  body: Record<string, string>
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams(body).toString(),
    signal: requestSignal()
  });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    json =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

function oauthErrorText(
  json: Record<string, unknown> | null,
  status: number
): string {
  if (json && typeof json['error'] === 'string') {
    const description =
      typeof json['error_description'] === 'string'
        ? `: ${json['error_description']}`
        : '';
    return `${json['error']}${description}`;
  }
  if (json && typeof json['message'] === 'string') return json['message'];
  if (json && typeof json['msg'] === 'string') return json['msg'];
  return `HTTP ${status}`;
}

/** RFC 7591 dynamic client registration for a public (PKCE) client with a loopback redirect. */
export async function registerClient(
  fetchImpl: FetchLike,
  registrationEndpoint: string,
  redirectUri: string
): Promise<string> {
  const response = await fetchImpl(registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      client_uri: CLIENT_URI,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'native'
    }),
    signal: requestSignal()
  });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    json =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
  } catch {
    json = null;
  }
  const clientId = json?.['client_id'];
  if (!response.ok || typeof clientId !== 'string' || !clientId) {
    throw new CliError(
      `Client registration at ${registrationEndpoint} failed (${oauthErrorText(json, response.status)}).`,
      1,
      'Dynamic registration may be disabled. Pass --client-id <id> (or set METER_OAUTH_CLIENT_ID) with a client registered for http://127.0.0.1 loopback redirects.'
    );
  }
  return clientId;
}

export function buildAuthorizationUrl(input: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
  scope?: string;
}): string {
  const url = new URL(input.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // RFC 8707 resource indicator: bind the token to the MCP endpoint.
  url.searchParams.set('resource', input.resource);
  if (input.scope) url.searchParams.set('scope', input.scope);
  return url.toString();
}

export function credentialFromToken(
  token: TokenResponse,
  extra: { tokenEndpoint: string; clientId: string; issuer: string },
  now = Date.now()
): Omit<StoredCredential, 'saved_at'> {
  const credential: Omit<StoredCredential, 'saved_at'> = {
    access_token: token.access_token,
    token_endpoint: extra.tokenEndpoint,
    client_id: extra.clientId,
    issuer: extra.issuer
  };
  if (typeof token.refresh_token === 'string' && token.refresh_token)
    credential.refresh_token = token.refresh_token;
  if (typeof token.expires_in === 'number' && Number.isFinite(token.expires_in))
    credential.expires_at = now + token.expires_in * 1000;
  if (typeof token.scope === 'string' && token.scope)
    credential.scope = token.scope;
  return credential;
}

/** Full OAuth 2.1 authorization-code + PKCE login over a loopback redirect. */
export async function runLogin(deps: LoginDeps): Promise<LoginResult> {
  const now = deps.now ?? (() => Date.now());
  const discovery = await discover(deps.origin, deps.fetch);
  const { authorizationServer, issuer } = discovery;
  const methods = authorizationServer.code_challenge_methods_supported;
  if (
    Array.isArray(methods) &&
    methods.length > 0 &&
    !methods.includes('S256')
  ) {
    throw new CliError(
      `The authorization server at ${issuer} does not support PKCE S256.`,
      1
    );
  }

  const cached = deps.clientId ? null : await deps.readRegisteredClient(issuer);
  const state = randomState();
  const pkce = createPkcePair();
  const start = deps.startLoopback ?? startLoopbackServer;
  let loopback = await start(state, cached?.redirect_port ?? 0);

  try {
    let clientId = deps.clientId ?? null;
    if (!clientId && cached && cached.redirect_port === loopback.port) {
      clientId = cached.client_id;
    }
    if (!clientId) {
      if (cached && cached.redirect_port !== loopback.port) {
        // The cached registration belongs to a port that is busy right now: register again for the new port.
        await loopback.close();
        loopback = await start(state, 0);
      }
      const registrationEndpoint = authorizationServer.registration_endpoint;
      if (typeof registrationEndpoint !== 'string' || !registrationEndpoint) {
        throw new CliError(
          `The authorization server at ${issuer} does not offer dynamic client registration.`,
          1,
          'Pass --client-id <id> (or set METER_OAUTH_CLIENT_ID) for a client registered with a http://127.0.0.1 loopback redirect URI.'
        );
      }
      clientId = await registerClient(
        deps.fetch,
        registrationEndpoint,
        loopback.redirectUri
      );
      await deps.saveRegisteredClient(issuer, {
        client_id: clientId,
        redirect_port: loopback.port
      });
    }

    // RFC 9728: the resource's scopes_supported are what this resource needs; the authorization
    // server's list covers every resource it protects and would over-ask.
    const scopes =
      discovery.resourceMetadata.scopes_supported ??
      authorizationServer.scopes_supported;
    const authorizationUrl = buildAuthorizationUrl({
      authorizationEndpoint: authorizationServer.authorization_endpoint,
      clientId,
      redirectUri: loopback.redirectUri,
      state,
      codeChallenge: pkce.challenge,
      resource: discovery.resource,
      scope:
        Array.isArray(scopes) && scopes.length ? scopes.join(' ') : undefined
    });
    await deps.onAuthorizationUrl(authorizationUrl);

    const code = await loopback.waitForCode(deps.timeoutMs ?? LOGIN_TIMEOUT_MS);
    const exchange = await postForm(
      deps.fetch,
      authorizationServer.token_endpoint,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: loopback.redirectUri,
        client_id: clientId,
        code_verifier: pkce.verifier,
        resource: discovery.resource
      }
    );
    const accessToken = exchange.json?.['access_token'];
    if (
      exchange.status >= 400 ||
      typeof accessToken !== 'string' ||
      !accessToken
    ) {
      throw new CliError(
        `Token exchange failed (${oauthErrorText(exchange.json, exchange.status)}).`,
        1,
        'Run `meter login` again.'
      );
    }
    const credential = credentialFromToken(
      exchange.json as TokenResponse,
      { tokenEndpoint: authorizationServer.token_endpoint, clientId, issuer },
      now()
    );
    return { credential, discovery, clientId };
  } finally {
    await loopback.close();
  }
}

export function needsRefresh(
  credential: StoredCredential,
  now = Date.now()
): boolean {
  return (
    typeof credential.expires_at === 'number' &&
    credential.expires_at - REFRESH_SKEW_MS <= now
  );
}

export function canRefresh(credential: StoredCredential): boolean {
  return Boolean(
    credential.refresh_token &&
    credential.token_endpoint &&
    credential.client_id
  );
}

/** Refresh-token grant; returns the new credential (refresh tokens may rotate). */
export async function refreshCredential(
  fetchImpl: FetchLike,
  credential: StoredCredential,
  now = Date.now()
): Promise<Omit<StoredCredential, 'saved_at'>> {
  if (!canRefresh(credential)) {
    throw new CliError(
      'The stored session cannot be refreshed.',
      1,
      'Run `meter login` again.'
    );
  }
  const response = await postForm(
    fetchImpl,
    credential.token_endpoint as string,
    {
      grant_type: 'refresh_token',
      refresh_token: credential.refresh_token as string,
      client_id: credential.client_id as string
    }
  );
  const accessToken = response.json?.['access_token'];
  if (
    response.status >= 400 ||
    typeof accessToken !== 'string' ||
    !accessToken
  ) {
    throw new CliError(
      `Refreshing the Meter session failed (${oauthErrorText(response.json, response.status)}).`,
      1,
      'Run `meter login` again.'
    );
  }
  const token = response.json as TokenResponse;
  const next = credentialFromToken(
    token,
    {
      tokenEndpoint: credential.token_endpoint as string,
      clientId: credential.client_id as string,
      issuer: credential.issuer ?? ''
    },
    now
  );
  if (!next.refresh_token) next.refresh_token = credential.refresh_token;
  if (!next.scope && credential.scope) next.scope = credential.scope;
  return next;
}
