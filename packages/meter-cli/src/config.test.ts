import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configDir,
  credentialsPath,
  decodeJwtPayload,
  deleteCredential,
  getCredential,
  maskToken,
  readRegisteredClient,
  saveCredential,
  saveRegisteredClient
} from './config.ts';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'meter-cli-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('credentials store', () => {
  it('resolves the config directory from env', () => {
    expect(configDir({ METER_CONFIG_DIR: '/tmp/x' })).toBe('/tmp/x');
    expect(configDir({ XDG_CONFIG_HOME: '/xdg' })).toBe('/xdg/meter');
    expect(configDir({ HOME: '/home/u' })).toBe('/home/u/.config/meter');
    expect(credentialsPath({ METER_CONFIG_DIR: dir })).toBe(
      join(dir, 'credentials.json')
    );
  });

  it('stores credentials per origin with mode 0600', async () => {
    const path = join(dir, 'credentials.json');
    await saveCredential(path, 'https://www.meterapp.co/', {
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 123
    });
    await saveCredential(path, 'http://127.0.0.1:4000', { access_token: 'b' });
    const mode = (await stat(path)).mode & 0o777;
    expect(mode).toBe(0o600);
    expect(await getCredential(path, 'https://www.meterapp.co')).toMatchObject({
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 123
    });
    expect(await getCredential(path, 'http://127.0.0.1:4000')).toMatchObject({
      access_token: 'b'
    });
    expect(await getCredential(path, 'https://other.example')).toBeNull();
    expect(await deleteCredential(path, 'https://www.meterapp.co')).toBe(true);
    expect(await deleteCredential(path, 'https://www.meterapp.co')).toBe(false);
    expect(await getCredential(path, 'http://127.0.0.1:4000')).not.toBeNull();
  });

  it('caches registered clients per issuer', async () => {
    const path = join(dir, 'oauth-clients.json');
    expect(
      await readRegisteredClient(path, 'https://as.example/auth/v1')
    ).toBeNull();
    await saveRegisteredClient(path, 'https://as.example/auth/v1', {
      client_id: 'c1',
      redirect_port: 43123
    });
    expect(
      await readRegisteredClient(path, 'https://as.example/auth/v1')
    ).toMatchObject({ client_id: 'c1', redirect_port: 43123 });
  });

  it('masks tokens and decodes JWT payloads for display', () => {
    expect(maskToken(undefined)).toBe('(none)');
    expect(maskToken('eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.sig')).toMatch(
      /^eyJhbGciOi…\.sig$/
    );
    const payload = Buffer.from(
      JSON.stringify({ exp: 1700000000, sub: 'u' })
    ).toString('base64url');
    expect(decodeJwtPayload(`h.${payload}.s`)).toEqual({
      exp: 1700000000,
      sub: 'u'
    });
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });
});
