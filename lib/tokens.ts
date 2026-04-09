import crypto from 'crypto';

/** Generate a cryptographically secure 256-bit token */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Hash a token with SHA-256 for safe DB storage */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
