import { createHash, randomBytes } from 'node:crypto';

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

/** RFC 7636: 43-128 char verifier from the unreserved alphabet, S256 challenge. */
export function createPkcePair(bytes = 48): PkcePair {
  const verifier = randomBytes(bytes).toString('base64url');
  return { verifier, challenge: challengeFor(verifier), method: 'S256' };
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function randomState(): string {
  return randomBytes(24).toString('base64url');
}
