/**
 * ═══════════════════════════════════════════════════════════════════════
 * CRYPTOGRAPHIC SECURITY & WEBHOOK VALIDATION
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Hardened security perimeter for:
 * - HMAC-SHA256 signature validation
 * - Timestamp verification with sliding window
 * - Nonce replay attack prevention
 * - Transaction spoofing detection
 * - Rate limiting per wallet
 */

import { keccak256, toHex } from 'viem';

// ────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  event: string;
  timestamp: number;
  data: Record<string, any>;
  signature: string;
  nonce: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

// ────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.VITE_WEBHOOK_SECRET || 'dev-webhook-secret';
const TIMESTAMP_WINDOW = 5 * 60 * 1000; // 5 minute sliding window
const NONCE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ────────────────────────────────────────────────────────────────────────
// NONCE REPLAY PROTECTION
// ────────────────────────────────────────────────────────────────────────

class NonceRegistry {
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

const nonceRegistry = new NonceRegistry();

// Cleanup nonces every hour
if (typeof window === 'undefined') {
  setInterval(() => {
    const cleaned = nonceRegistry.cleanup();
    if (cleaned > 0) {
      console.log(`[Security] Cleaned ${cleaned} expired nonces`);
    }
  }, 60 * 60 * 1000);
}

// ────────────────────────────────────────────────────────────────────────
// HMAC-SHA256 SIGNATURE VALIDATION
// ────────────────────────────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 signature for webhook validation
 * @param payload The payload to sign
 * @param secret The shared secret
 * @returns Base64-encoded signature
 */
export async function generateSignature(
  payload: string,
  secret: string = WEBHOOK_SECRET
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  // Convert to hex string (common for blockchain)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify HMAC-SHA256 signature
 * @param payload The original payload
 * @param signature The signature to verify
 * @param secret The shared secret
 * @returns True if valid
 */
export async function verifySignature(
  payload: string,
  signature: string,
  secret: string = WEBHOOK_SECRET
): Promise<boolean> {
  try {
    const expectedSignature = await generateSignature(payload, secret);
    // Constant-time comparison to prevent timing attacks
    return constantTimeEqual(signature, expectedSignature);
  } catch (error) {
    console.error('[Security] Signature verification failed:', error);
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────
// CONSTANT-TIME STRING COMPARISON
// ────────────────────────────────────────────────────────────────────────

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// ────────────────────────────────────────────────────────────────────────
// WEBHOOK VALIDATION
// ────────────────────────────────────────────────────────────────────────

export async function validateWebhook(
  payload: WebhookPayload
): Promise<ValidationResult> {
  // 1. Validate timestamp (sliding window)
  const now = Date.now();
  const payloadTime = payload.timestamp;
  const timeDiff = Math.abs(now - payloadTime);

  if (timeDiff > TIMESTAMP_WINDOW) {
    return {
      valid: false,
      reason: `Timestamp outside acceptable window. Diff: ${timeDiff}ms, Window: ${TIMESTAMP_WINDOW}ms`,
    };
  }

  // 2. Check nonce uniqueness (replay attack prevention)
  if (nonceRegistry.isUsed(payload.nonce)) {
    return {
      valid: false,
      reason: `Nonce already used: ${payload.nonce}`,
    };
  }

  // 3. Verify signature
  const payloadString = JSON.stringify({
    event: payload.event,
    timestamp: payload.timestamp,
    data: payload.data,
    nonce: payload.nonce,
  });

  const isValidSignature = await verifySignature(
    payloadString,
    payload.signature
  );

  if (!isValidSignature) {
    return {
      valid: false,
      reason: 'Invalid signature',
    };
  }

  // 4. Register nonce for future replay prevention
  nonceRegistry.register(payload.nonce);

  return {
    valid: true,
    timestamp: payloadTime,
  };
}

// ────────────────────────────────────────────────────────────────────────
// TRANSACTION VALIDATION
// ────────────────────────────────────────────────────────────────────────

export interface TransactionData {
  to: string;
  from: string;
  value: string;
  data: string;
  gasPrice: string;
  nonce: number;
}

/**
 * Validate transaction data to prevent spoofing
 * Ensures all required fields are present and properly formatted
 */
export function validateTransaction(tx: TransactionData): ValidationResult {
  // Validate Ethereum addresses
  if (!isValidEthereumAddress(tx.to)) {
    return { valid: false, reason: 'Invalid recipient address' };
  }

  if (!isValidEthereumAddress(tx.from)) {
    return { valid: false, reason: 'Invalid sender address' };
  }

  // Validate value is numeric
  if (!/^\d+$/.test(tx.value)) {
    return { valid: false, reason: 'Invalid value format' };
  }

  // Validate data is hex
  if (!/^0x[0-9a-fA-F]*$/.test(tx.data)) {
    return { valid: false, reason: 'Invalid data format' };
  }

  // Validate gas price
  if (!/^\d+$/.test(tx.gasPrice)) {
    return { valid: false, reason: 'Invalid gas price format' };
  }

  // Validate nonce
  if (tx.nonce < 0 || !Number.isInteger(tx.nonce)) {
    return { valid: false, reason: 'Invalid nonce' };
  }

  return { valid: true };
}

// ────────────────────────────────────────────────────────────────────────
// ETHEREUM ADDRESS VALIDATION
// ────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────
// RATE LIMITING PER WALLET
// ────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  requests: number;
  resetAt: number;
}

class RateLimiter {
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
      // Window expired or first request
      this.limits.set(key, {
        requests: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    // Check if under limit
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

export const walletRateLimiter = new RateLimiter(60000, 100); // 100 req/min per wallet
export const transactionRateLimiter = new RateLimiter(60000, 10); // 10 tx/min per wallet

// Cleanup rate limits every 10 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    walletRateLimiter.cleanup();
    transactionRateLimiter.cleanup();
  }, 10 * 60 * 1000);
}

// ────────────────────────────────────────────────────────────────────────
// WALLET AUTHENTICATION
// ────────────────────────────────────────────────────────────────────────

export interface SignatureVerificationData {
  message: string;
  signature: string;
  address: string;
}

/**
 * Generate a message for wallet signing (SIWE - Sign In With Ethereum)
 */
export function generateAuthMessage(
  address: string,
  nonce: string = Math.random().toString(36).slice(2)
): string {
  return `Sign this message to authenticate with ArcCards.

Address: ${address}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}`;
}

/**
 * Create a nonce for authentication
 * Used to prevent replay attacks
 */
export function generateAuthNonce(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}