import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Env } from './output.ts';

/** One stored OAuth session for one API origin. */
export interface StoredCredential {
  access_token: string;
  refresh_token?: string;
  /** Unix epoch milliseconds when access_token expires; absent for tokens pasted with --token. */
  expires_at?: number;
  token_endpoint?: string;
  client_id?: string;
  issuer?: string;
  scope?: string;
  /** ISO 8601 time the credential was written. */
  saved_at: string;
}

export interface CredentialsFile {
  version: 1;
  origins: Record<string, StoredCredential>;
}

/** Cached dynamic-registration result per authorization-server issuer. */
export interface RegisteredClient {
  client_id: string;
  /** Loopback port registered in redirect_uris; reused so the redirect URI stays valid. */
  redirect_port: number;
  registered_at: string;
}

export interface ClientsFile {
  version: 1;
  issuers: Record<string, RegisteredClient>;
}

/** `$METER_CONFIG_DIR`, else `$XDG_CONFIG_HOME/meter`, else `~/.config/meter`. */
export function configDir(env: Env = process.env): string {
  const explicit = env['METER_CONFIG_DIR']?.trim();
  if (explicit) return explicit;
  const root =
    env['XDG_CONFIG_HOME']?.trim() ||
    join(env['HOME']?.trim() || homedir(), '.config');
  return join(root, 'meter');
}

export function credentialsPath(env: Env = process.env): string {
  return join(configDir(env), 'credentials.json');
}

export function clientsPath(env: Env = process.env): string {
  return join(configDir(env), 'oauth-clients.json');
}

export async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/** Atomic write (temp file + rename) with a private mode; parent directory is 0700. */
export async function writeJsonFile(
  path: string,
  value: unknown,
  mode = 0o600
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode });
  await chmod(temp, mode);
  await rename(temp, path);
  await chmod(path, mode);
}

export function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid API origin "${value}". Expected something like https://www.meterapp.co`
    );
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(
      `Invalid API origin "${value}". Only http(s) origins are supported.`
    );
  }
  return url.origin;
}

export async function readCredentials(path: string): Promise<CredentialsFile> {
  const raw = await readJsonFile<Partial<CredentialsFile>>(path);
  if (
    !raw ||
    raw.version !== 1 ||
    !raw.origins ||
    typeof raw.origins !== 'object'
  ) {
    return { version: 1, origins: {} };
  }
  const origins: Record<string, StoredCredential> = {};
  for (const [origin, entry] of Object.entries(raw.origins)) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.access_token === 'string' &&
      entry.access_token
    ) {
      origins[origin] = entry;
    }
  }
  return { version: 1, origins };
}

export async function getCredential(
  path: string,
  origin: string
): Promise<StoredCredential | null> {
  const file = await readCredentials(path);
  return file.origins[normalizeOrigin(origin)] ?? null;
}

export async function saveCredential(
  path: string,
  origin: string,
  credential: Omit<StoredCredential, 'saved_at'>
): Promise<StoredCredential> {
  const file = await readCredentials(path);
  const clean: StoredCredential = {
    ...credential,
    saved_at: new Date().toISOString()
  };
  for (const key of Object.keys(clean) as Array<keyof StoredCredential>) {
    if (clean[key] === undefined || clean[key] === null || clean[key] === '')
      delete clean[key];
  }
  file.origins[normalizeOrigin(origin)] = clean;
  await writeJsonFile(path, file, 0o600);
  return clean;
}

/** Removes one origin's credential; returns whether anything was removed. Deletes the file when empty. */
export async function deleteCredential(
  path: string,
  origin: string
): Promise<boolean> {
  const file = await readCredentials(path);
  const key = normalizeOrigin(origin);
  if (!(key in file.origins)) return false;
  delete file.origins[key];
  if (Object.keys(file.origins).length === 0) {
    await unlink(path).catch(() => undefined);
  } else {
    await writeJsonFile(path, file, 0o600);
  }
  return true;
}

export async function readRegisteredClient(
  path: string,
  issuer: string
): Promise<RegisteredClient | null> {
  const raw = await readJsonFile<Partial<ClientsFile>>(path);
  const entry = raw?.version === 1 ? raw.issuers?.[issuer] : undefined;
  if (
    !entry ||
    typeof entry.client_id !== 'string' ||
    typeof entry.redirect_port !== 'number'
  )
    return null;
  return entry;
}

export async function saveRegisteredClient(
  path: string,
  issuer: string,
  client: Omit<RegisteredClient, 'registered_at'>
): Promise<void> {
  const raw = (await readJsonFile<Partial<ClientsFile>>(path)) ?? {};
  const issuers = raw.version === 1 && raw.issuers ? raw.issuers : {};
  issuers[issuer] = { ...client, registered_at: new Date().toISOString() };
  await writeJsonFile(
    path,
    { version: 1, issuers } satisfies ClientsFile,
    0o600
  );
}

/** Display form such as `eyJhbGciOi…9zY`; the full token is never printed. */
export function maskToken(token: string | undefined): string {
  if (!token) return '(none)';
  if (token.length <= 16) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 10)}…${token.slice(-4)}`;
}

/** Decodes the JWT payload without verifying it, for display only. */
export function decodeJwtPayload(
  token: string
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1] ?? '', 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
