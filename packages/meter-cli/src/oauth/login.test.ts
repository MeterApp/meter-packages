import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClientContext } from '../client.ts';
import {
  clientsPath,
  credentialsPath,
  getCredential,
  readRegisteredClient,
  saveCredential,
  saveRegisteredClient
} from '../config.ts';
import { main } from '../main.ts';
import {
  captureIo,
  startFakeMeter,
  type FakeMeter
} from '../test-helpers/fake-meter.ts';
import { discover } from './discovery.ts';
import { needsRefresh, refreshCredential, runLogin } from './login.ts';

let fake: FakeMeter;
let dir: string;
let env: Record<string, string>;

beforeEach(async () => {
  fake = await startFakeMeter();
  dir = await mkdtemp(join(tmpdir(), 'meter-login-'));
  env = { METER_CONFIG_DIR: dir, METER_API_ORIGIN: fake.origin, HOME: dir };
});
afterEach(async () => {
  await fake.close();
  await rm(dir, { recursive: true, force: true });
});

function loginDeps(overrides: Partial<Parameters<typeof runLogin>[0]> = {}) {
  const clients = clientsPath(env);
  return {
    fetch: globalThis.fetch,
    origin: fake.origin,
    readRegisteredClient: (issuer: string) =>
      readRegisteredClient(clients, issuer),
    saveRegisteredClient: (
      issuer: string,
      client: { client_id: string; redirect_port: number }
    ) => saveRegisteredClient(clients, issuer, client),
    onAuthorizationUrl: (url: string) => {
      void fake.approve(url);
    },
    timeoutMs: 5000,
    ...overrides
  };
}

describe('discovery', () => {
  it('follows resource metadata to the authorization server', async () => {
    const discovery = await discover(fake.origin, fetch);
    expect(discovery.issuer).toBe(fake.issuer);
    expect(discovery.resource).toBe(`${fake.origin}/api/mcp/fleet`);
    expect(discovery.resourceMetadataUrl).toBe(
      `${fake.origin}/.well-known/oauth-protected-resource/api/mcp/fleet`
    );
    expect(discovery.authorizationServer.registration_endpoint).toBe(
      `${fake.issuer}/oauth/clients/register`
    );
  });

  it('falls back to the RFC 8414 path-inserted metadata URL', async () => {
    const rfc = await startFakeMeter({ rfc8414Only: true });
    try {
      const discovery = await discover(rfc.origin, fetch);
      expect(discovery.authorizationServerMetadataUrl).toBe(
        `${rfc.origin}/.well-known/oauth-authorization-server/auth/v1`
      );
    } finally {
      await rfc.close();
    }
  });
});

describe('runLogin', () => {
  it('registers a client, runs PKCE over the loopback redirect and exchanges the code', async () => {
    const result = await runLogin(loginDeps());
    expect(fake.registrations).toHaveLength(1);
    expect(fake.registrations[0]).toMatchObject({
      client_name: 'Meter CLI',
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token']
    });
    expect((fake.registrations[0]?.['redirect_uris'] as string[])[0]).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/
    );
    expect(result.clientId).toBe('client_1');
    expect(fake.tokens.has(result.credential.access_token)).toBe(true);
    expect(result.credential.refresh_token).toMatch(/^rt_/);
    expect(result.credential.expires_at).toBeGreaterThan(Date.now());
    const authorize = fake.authorizeRequests[0] as URL;
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('resource')).toBe(
      `${fake.origin}/api/mcp/fleet`
    );
    expect(authorize.searchParams.get('scope')).toBe('openid email profile');
    // The registration (and its loopback port) is cached for the next login.
    const cached = await readRegisteredClient(clientsPath(env), fake.issuer);
    expect(cached).toMatchObject({ client_id: 'client_1' });
    await runLogin(loginDeps());
    expect(fake.registrations).toHaveLength(1);
  });

  it('skips registration when a client id is supplied', async () => {
    const result = await runLogin(loginDeps({ clientId: 'preconfigured' }));
    expect(fake.registrations).toHaveLength(0);
    expect(result.clientId).toBe('preconfigured');
  });

  it('fails clearly when registration is disabled and no client id is given', async () => {
    const closed = await startFakeMeter({ registration: false });
    try {
      await expect(
        runLogin(
          loginDeps({
            origin: closed.origin,
            onAuthorizationUrl: () => undefined
          })
        )
      ).rejects.toThrow(/does not offer dynamic client registration/);
    } finally {
      await closed.close();
    }
  });

  it("ignores callbacks that do not carry this attempt's state, including error callbacks", async () => {
    const result = await runLogin(
      loginDeps({
        onAuthorizationUrl: async (url) => {
          const redirect = new URL(
            new URL(url).searchParams.get('redirect_uri') as string
          );
          redirect.searchParams.set('error', 'access_denied');
          const probe = await fetch(redirect);
          expect(probe.status).toBe(400);
          await fake.approve(url);
        }
      })
    );
    expect(fake.tokens.has(result.credential.access_token)).toBe(true);
  });

  it('refuses metadata whose issuer does not match the advertised authorization server', async () => {
    const spoofed = await startFakeMeter({
      issuerOverride: 'https://evil.example/auth/v1'
    });
    try {
      await expect(
        runLogin(
          loginDeps({
            origin: spoofed.origin,
            onAuthorizationUrl: () => undefined
          })
        )
      ).rejects.toThrow(/claims issuer https:\/\/evil\.example/);
    } finally {
      await spoofed.close();
    }
  });

  it('surfaces authorization errors from the browser redirect', async () => {
    await expect(
      runLogin(
        loginDeps({
          onAuthorizationUrl: async (url) => {
            const redirect = new URL(
              new URL(url).searchParams.get('redirect_uri') as string
            );
            redirect.searchParams.set('error', 'access_denied');
            redirect.searchParams.set('error_description', 'user declined');
            redirect.searchParams.set(
              'state',
              new URL(url).searchParams.get('state') as string
            );
            await fetch(redirect);
          }
        })
      )
    ).rejects.toThrow(/access_denied/);
  });
});

describe('refresh', () => {
  it('refreshes an expiring stored session transparently', async () => {
    const login = await runLogin(loginDeps());
    const path = credentialsPath(env);
    await saveCredential(path, fake.origin, {
      ...login.credential,
      expires_at: Date.now() - 1000
    });
    const stored = await getCredential(path, fake.origin);
    expect(stored && needsRefresh(stored)).toBe(true);
    const context = createClientContext({}, env);
    const token = await context.token();
    expect(token?.source).toBe('stored');
    expect(token?.accessToken).not.toBe(login.credential.access_token);
    expect(fake.tokens.has(token?.accessToken ?? '')).toBe(true);
    const after = await getCredential(path, fake.origin);
    expect(after?.access_token).toBe(token?.accessToken);
    expect(after?.expires_at).toBeGreaterThan(Date.now());
    expect(after?.refresh_token).not.toBe(login.credential.refresh_token);
  });

  it('fails with a login hint when the refresh token is rejected', async () => {
    await expect(
      refreshCredential(fetch, {
        access_token: 'a',
        refresh_token: 'bogus',
        token_endpoint: `${fake.issuer}/oauth/token`,
        client_id: 'c',
        saved_at: ''
      })
    ).rejects.toThrow(/Refreshing the Meter session failed/);
  });
});

describe('meter login (command)', () => {
  it('stores the session and prints a summary', async () => {
    const captured = captureIo({ json: true });
    const approve = setInterval(() => {
      const match =
        /(http:\/\/127\.0\.0\.1:\d+\/auth\/v1\/oauth\/authorize\?[^\s]+)/.exec(
          captured.stderr()
        );
      if (match) {
        clearInterval(approve);
        void fake.approve(match[1] as string);
      }
    }, 20);
    const code = await main(['login', '--no-browser', '--json'], {
      env,
      io: captured.io
    });
    clearInterval(approve);
    expect(code).toBe(0);
    const summary = JSON.parse(captured.stdout()) as Record<string, unknown>;
    expect(summary).toMatchObject({
      ok: true,
      origin: fake.origin,
      issuer: fake.issuer,
      refreshable: true
    });
    const stored = await getCredential(credentialsPath(env), fake.origin);
    expect(stored?.access_token).toBeTruthy();
    expect(fake.tokens.has(stored?.access_token ?? '')).toBe(true);

    const out = captureIo();
    expect(await main(['logout'], { env, io: out.io })).toBe(0);
    expect(out.stdout()).toMatch(/Signed out/);
    expect(await getCredential(credentialsPath(env), fake.origin)).toBeNull();
  });

  it('stores a pasted token with --token', async () => {
    const captured = captureIo();
    const payload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })
    ).toString('base64url');
    expect(
      await main(['login', '--token', `h.${payload}.s`], {
        env,
        io: captured.io
      })
    ).toBe(0);
    const stored = await getCredential(credentialsPath(env), fake.origin);
    expect(stored?.access_token).toBe(`h.${payload}.s`);
    expect(stored?.expires_at).toBeGreaterThan(Date.now());
  });
});
