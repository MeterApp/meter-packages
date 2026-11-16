import { MCP_SURFACES } from '@meterapp/meter-sdk/mcp';
import { CliError } from '../errors.ts';

export type FetchLike = typeof fetch;

/** RFC 9728 protected resource metadata (the subset the CLI needs). */
export interface ProtectedResourceMetadata {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  resource_name?: string;
  [key: string]: unknown;
}

/** RFC 8414 authorization server metadata (the subset the CLI needs). */
export interface AuthorizationServerMetadata {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  [key: string]: unknown;
}

export interface Discovery {
  origin: string;
  resource: string;
  resourceMetadataUrl: string;
  resourceMetadata: ProtectedResourceMetadata;
  issuer: string;
  authorizationServerMetadataUrl: string;
  authorizationServer: AuthorizationServerMetadata;
}

const trim = (value: string) => value.replace(/\/+$/, '');

/**
 * RFC 9728 section 3.1 metadata for Meter for Drivers & Fleets. Both MCP
 * servers share one issuer, so the session it signs in works on either.
 */
export function protectedResourceMetadataUrl(origin: string): string {
  return `${trim(origin)}/.well-known/oauth-protected-resource${MCP_SURFACES.fleet.path}`;
}

/**
 * Candidate metadata URLs for an issuer, in order: the path-appended form most
 * OAuth servers (including Supabase Auth) serve, the RFC 8414 path-inserted
 * form, then OpenID Connect discovery as a last resort.
 */
export function authorizationServerMetadataUrls(issuer: string): string[] {
  const url = new URL(trim(issuer));
  const path = url.pathname === '/' ? '' : trim(url.pathname);
  const candidates = [`${trim(issuer)}/.well-known/oauth-authorization-server`];
  if (path)
    candidates.push(
      `${url.origin}/.well-known/oauth-authorization-server${path}`
    );
  candidates.push(`${trim(issuer)}/.well-known/openid-configuration`);
  if (path)
    candidates.push(`${url.origin}/.well-known/openid-configuration${path}`);
  return [...new Set(candidates)];
}

/** Every OAuth/metadata request gives up after this long so a hanging server cannot hang the CLI. */
export const HTTP_TIMEOUT_MS = 20_000;

export function requestSignal(): AbortSignal {
  return AbortSignal.timeout(HTTP_TIMEOUT_MS);
}

async function fetchJson(
  fetchImpl: FetchLike,
  url: string
): Promise<{ status: number; json: unknown }> {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    redirect: 'follow',
    signal: requestSignal()
  });
  const text = await response.text();
  let json: unknown = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, json };
}

export async function fetchProtectedResourceMetadata(
  origin: string,
  fetchImpl: FetchLike
): Promise<{ url: string; metadata: ProtectedResourceMetadata }> {
  const url = protectedResourceMetadataUrl(origin);
  const { status, json } = await fetchJson(fetchImpl, url);
  if (status !== 200 || !json || typeof json !== 'object') {
    throw new CliError(
      `Could not load OAuth resource metadata from ${url} (HTTP ${status}).`,
      1,
      `Check --api / METER_API_ORIGIN. Meter publishes /.well-known/oauth-protected-resource${MCP_SURFACES.fleet.path}.`
    );
  }
  return { url, metadata: json as ProtectedResourceMetadata };
}

export async function fetchAuthorizationServerMetadata(
  issuer: string,
  fetchImpl: FetchLike
): Promise<{ url: string; metadata: AuthorizationServerMetadata }> {
  const attempts: string[] = [];
  for (const url of authorizationServerMetadataUrls(issuer)) {
    let status = 0;
    let json: unknown = null;
    try {
      ({ status, json } = await fetchJson(fetchImpl, url));
    } catch (error) {
      if (error instanceof CliError) throw error;
      attempts.push(
        `${url} (${error instanceof Error ? error.message : String(error)})`
      );
      continue;
    }
    if (status === 200 && json && typeof json === 'object') {
      const metadata = json as Partial<AuthorizationServerMetadata>;
      if (
        typeof metadata.authorization_endpoint === 'string' &&
        typeof metadata.token_endpoint === 'string'
      ) {
        // RFC 8414 section 3.3: the issuer in the document must be the one we asked about, or the
        // endpoints (where the code and verifier are posted) cannot be trusted.
        if (
          typeof metadata.issuer === 'string' &&
          trim(metadata.issuer) !== trim(issuer)
        ) {
          throw new CliError(
            `Authorization server metadata at ${url} claims issuer ${metadata.issuer}, expected ${issuer}.`,
            1,
            'Refusing to continue: the metadata document does not belong to the advertised authorization server.'
          );
        }
        return { url, metadata: metadata as AuthorizationServerMetadata };
      }
      attempts.push(`${url} (missing authorization_endpoint/token_endpoint)`);
      continue;
    }
    attempts.push(`${url} (HTTP ${status})`);
  }
  throw new CliError(
    `Could not load OAuth authorization server metadata for ${issuer}.`,
    1,
    `Tried: ${attempts.join('; ')}. The Meter OAuth server may not be enabled for this origin yet.`
  );
}

/** Resource metadata, then authorization-server metadata. */
export async function discover(
  origin: string,
  fetchImpl: FetchLike
): Promise<Discovery> {
  const cleanOrigin = trim(origin);
  const resource = await fetchProtectedResourceMetadata(cleanOrigin, fetchImpl);
  const issuer = resource.metadata.authorization_servers?.find(
    (entry) => typeof entry === 'string' && /^https?:\/\//i.test(entry)
  );
  if (!issuer) {
    throw new CliError(
      `${resource.url} lists no authorization server.`,
      1,
      'The Meter deployment has no OAuth authorization server configured. Use `meter login --token <access token>` meanwhile.'
    );
  }
  const authorizationServer = await fetchAuthorizationServerMetadata(
    issuer,
    fetchImpl
  );
  return {
    origin: cleanOrigin,
    resource:
      typeof resource.metadata.resource === 'string'
        ? resource.metadata.resource
        : `${cleanOrigin}${MCP_SURFACES.fleet.path}`,
    resourceMetadataUrl: resource.url,
    resourceMetadata: resource.metadata,
    issuer: trim(issuer),
    authorizationServerMetadataUrl: authorizationServer.url,
    authorizationServer: authorizationServer.metadata
  };
}
