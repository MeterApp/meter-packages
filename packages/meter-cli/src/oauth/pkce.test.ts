import { describe, expect, it } from 'vitest';
import { challengeFor, createPkcePair, randomState } from './pkce.ts';
import { authorizationServerMetadataUrls } from './discovery.ts';

describe('PKCE', () => {
  it('matches the RFC 7636 appendix B vector', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  it('creates verifiers in the allowed alphabet and length', () => {
    const pair = createPkcePair();
    expect(pair.method).toBe('S256');
    expect(pair.verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(pair.challenge).toBe(challengeFor(pair.verifier));
    expect(randomState()).not.toBe(randomState());
  });
});

describe('authorization server metadata discovery', () => {
  it('tries the path-appended URL, then RFC 8414 path-inserted, then OIDC', () => {
    expect(
      authorizationServerMetadataUrls('https://proj.supabase.co/auth/v1')
    ).toEqual([
      'https://proj.supabase.co/auth/v1/.well-known/oauth-authorization-server',
      'https://proj.supabase.co/.well-known/oauth-authorization-server/auth/v1',
      'https://proj.supabase.co/auth/v1/.well-known/openid-configuration',
      'https://proj.supabase.co/.well-known/openid-configuration/auth/v1'
    ]);
    expect(authorizationServerMetadataUrls('https://as.example/')).toEqual([
      'https://as.example/.well-known/oauth-authorization-server',
      'https://as.example/.well-known/openid-configuration'
    ]);
  });
});
