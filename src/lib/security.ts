/**
 * ═══════════════════════════════════════════════════════════════════════
 * CRYPTOGRAPHIC SECURITY - CLIENT-SIDE VALIDATION HELPERS
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * ⚠️  SECURITY NOTICE:
 * This file is bundled in the CLIENT. Never use it for:
 *   - Webhook signature validation (secrets leak)
 *   - Authorization decisions
 *   - Server-side state changes
 * 
 * Server-side webhook validation must live in a backend API route.
 * This file provides:
 *   - Client-side input validation (addresses, transactions)
 *   - SIWE (Sign In With Ethereum) message generation
 *   - Client-side rate limiting (UX, not security)
 *   - Nonce generation utilities
 */

import { keccak256, toHex } from 'viem';

// ────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────────────────────────

const TIMESTAMP_WINDOW = 5 * 60 * 1000; // 5 minute sliding window
const NONCE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

export interface TransactionData {
  to: string;
  from: string;
  value: string;
  data: string;
  gasPrice: string;
  nonce: number;
}

export interface SignatureVerificationData {
  message: string;
  signature: string;
  address: string;
}

// ────────────────────────────────────────────────────────────────────────
// INPUT VALIDATION HELPERS (client-side UX, not security)
// ────────────────────────────────────────────────────────────────────────

/**
 * Validate Ethereum address format.
 * For real auth, verify a signed message via backend.
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return false;
  }

  // Validate checksum if mixed case
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    return validateEthereumChecksum(address);
  }

  return true;
}

function validateEthereumChecksum(address: string): boolean {
  const addr = address.slice(2);
  const hash = keccak256(toHex(addr.toLowerCase()));
  const hashStr = hash.slice(2);

  for (let i = 0; i < 40; i++) {
    const hashValue = parseInt(hashStr[i], 16);
    const shouldBeUppercase = hashValue >= 8;
    const isUppercase = addr[i] === addr[i].toUpperCase();

    if (shouldBeUppercase !== isUppercase) {
      return false;
    }
  }

  return true;
}

/**
 * Validate transaction shape before submitting to wallet.
 * Catches malformed inputs. Backend must still validate before signing.
 */
export function validateTransaction(tx: TransactionData): ValidationResult {
  if (!isValidEthereumAddress(tx.to)) {
    return { valid: false, reason: 'Invalid recipient address' };
  }

  if (!isValidEthereumAddress(tx.from)) {
    return { valid: false, reason: 'Invalid sender address' };
  }

  if (!/^\d+$/.test(tx.value)) {
    return { valid: false, reason: 'Invalid value format' };
  }

  if (!/^0x[0-9a-fA-F]*$/.test(tx.data)) {
    return { valid: false, reason: 'Invalid data format' };
  }

  if (!/^\d+$/.test(tx.gasPrice)) {
    return { valid: false, reason: 'Invalid gas price format' };
  }

  if (tx.nonce < 0 || !Number.isInteger(tx.nonce)) {
    return { valid: false, reason: 'Invalid nonce' };
  }

  return { valid: true };
}

// ────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE NONCE TRACKING (UX hint only — bypassable by attacker)
// ────────────────────────────────────────────────────────────────────────

/**
 * Tracks nonces seen in this tab to give the user a friendly
 * "already used" error. DO NOT rely on this for security — a
 * determined attacker can clear storage or open incognito.
 * Real replay protection must be enforced server-side.
 */
class ClientNonceRegistry {
  private usedNonces: Map<string, number> = new Map();

  isUsed(nonce: string): boolean {
    if (!this.usedNonces.has(nonce)) return false;

    const createdAt = this.usedNonces.get(nonce)!;
    const isExpired = Date.now() - createdAt > NONCE_CACHE_TTL;

    if (isExpired) {
      this.usedNonces.delete(nonce);
      return false;
    }

    return true;
  }

  register(nonce: string): void {
    this.usedNonces.set(nonce, Date.now());
  }

  cleanup(): number {
    const before = this.usedNonces.size;
    const now = Date.now();

    for (const [nonce, createdAt] of this.usedNonces.entries()) {
      if (now - createdAt > NONCE_CACHE_TTL) {
        this.usedNonces.delete(nonce);
      }
    }

    return before - this.usedNonces.size;
  }
}

export const clientNonceRegistry = new ClientNonceRegistry();

// ────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE RATE LIMITING (UX hint only — bypassable by attacker)
// ────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  requests: number;
  resetAt: number;
}

/**
 * Per-wallet request throttling for friendlier UX. Server-side
 * rate limiting at the API gateway / Supabase is the real gate.
 */
class ClientRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      this.limits.set(key, {
        requests: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (entry.requests < this.maxRequests) {
      entry.requests++;
      return true;
    }

    return false;
  }

  getRemainingRequests(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() > entry.resetAt) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.requests);
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

export const walletRateLimiter = new ClientRateLimiter(60000, 100);
export const transactionRateLimiter = new ClientRateLimiter(60000, 10);

// ────────────────────────────────────────────────────────────────────────
// SIWE (Sign In With Ethereum) — client message builder
// ────────────────────────────────────────────────────────────────────────

/**
 * Build the message the user signs in their wallet.
 * Backend must verify the signature against the recovered address.
 */
export function generateAuthMessage(
  address: string,
  nonce: string
): string {
  if (!isValidEthereumAddress(address)) {
    throw new Error('Invalid wallet address');
  }
  return `Sign this message to authenticate with ArcCards.

Address: ${address}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}`;
}

/**
 * Cryptographically strong nonce for SIWE flows.
 * Backend should track which nonces have been used to prevent replay.
 */
export function generateAuthNonce(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ────────────────────────────────────────────────────────────────────────
// REMOVED (previously exposed in client bundle):
//   - WEBHOOK_SECRET
//   - generateSignature / verifySignature (HMAC)
//   - validateWebhook
//
// Webhook signature verification MUST run on a server (e.g. Vercel
// Edge / Node function). A template is provided in
//   api/webhooks/validate.ts
// and must NOT be imported from client code.
// ────────────────────────────────────────────────────────────────────────