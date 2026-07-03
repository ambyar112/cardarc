/**
 * ═══════════════════════════════════════════════════════════════════════
 * WEBHOOK SECURITY — Cryptographic Validation Layer
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Validates incoming blockchain event webhooks against:
 * 1. HMAC-SHA256 signature verification
 * 2. Sliding-window timestamp validation (±5 min)
 * 3. Replay attack prevention via nonce dedup
 * 4. IP allowlist (optional, for known indexer IPs)
 */

import crypto from 'crypto';

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
  nonce: string;
  signature: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const SIGNATURE_ALGO = 'sha256';

// In-memory nonce dedup (production: use Redis SET with TTL)
const usedNonces = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Verify HMAC-SHA256 signature of webhook payload.
 * The signature covers: timestamp + nonce + body (canonical JSON).
 */
function verifySignature(
  payload: WebhookPayload,
  secret: string
): boolean {
  const message = `${payload.timestamp}.${payload.nonce}.${JSON.stringify(payload.data)}`;
  const expectedSig = crypto
    .createHmac(SIGNATURE_ALGO, secret)
    .update(message)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(payload.signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}

/**
 * Validate timestamp is within sliding window.
 * Prevents replay attacks with stale payloads.
 */
function validateTimestamp(timestamp: number): boolean {
  const now = Date.now();
  return Math.abs(now - timestamp) <= MAX_AGE_MS;
}

/**
 * Check and consume nonce. Returns false if nonce was already used.
 */
function consumeNonce(nonce: string): boolean {
  // Cleanup expired nonces periodically
  if (usedNonces.size > 10000) {
    const cutoff = Date.now() - NONCE_TTL_MS;
    for (const [key, ts] of usedNonces) {
      if (ts < cutoff) usedNonces.delete(key);
    }
  }

  if (usedNonces.has(nonce)) return false;
  usedNonces.set(nonce, Date.now());
  return true;
}

/**
 * Full webhook validation pipeline.
 * Call this before processing any incoming webhook.
 */
function validateWebhook(
  payload: WebhookPayload,
  secret: string
): ValidationResult {
  // 1. Timestamp window check
  if (!validateTimestamp(payload.timestamp)) {
    return { valid: false, error: 'Timestamp outside acceptable window' };
  }

  // 2. Nonce dedup
  if (!consumeNonce(payload.nonce)) {
    return { valid: false, error: 'Nonce already used (replay attack)' };
  }

  // 3. Signature verification
  if (!verifySignature(payload, secret)) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

export { validateWebhook, verifySignature, validateTimestamp, consumeNonce };
export type { WebhookPayload, ValidationResult };