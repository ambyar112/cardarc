/**
 * ═══════════════════════════════════════════════════════════════════════
 * SERVER-SIDE WEBHOOK VALIDATION API
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Deploy as Vercel Edge Function or similar serverless endpoint.
 * Validates webhook signatures using HMAC-SHA256.
 * 
 * Environment variables required:
 *   WEBHOOK_SECRET - Server-only secret (NOT prefixed with VITE_)
 * 
 * Usage:
 *   POST /api/webhooks/validate
 *   Body: { payload: {...}, signature: "...", timestamp: "..." }
 */

// Edge runtime: use Web Crypto API (no Node 'crypto' module)

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const TIMESTAMP_WINDOW = 5 * 60 * 1000; // 5 minutes

if (!WEBHOOK_SECRET) {
  throw new Error('WEBHOOK_SECRET environment variable is required');
}

interface WebhookRequest {
  payload: Record<string, any>;
  signature: string;
  timestamp: string;
}

interface ValidationResponse {
  valid: boolean;
  reason?: string;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload using Web Crypto API.
 */
async function generateSignature(payload: string, timestamp: string): Promise<string> {
  const message = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify webhook signature using constant-time comparison.
 */
async function verifySignature(
  payload: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  const expected = await generateSignature(payload, timestamp);
  
  if (signature.length !== expected.length) {
    return false;
  }

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate webhook timestamp is within acceptable window.
 */
function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const now = Date.now();
  const diff = Math.abs(now - ts);
  
  return diff <= TIMESTAMP_WINDOW;
}

/**
 * Main webhook validation handler.
 */
export default async function handler(req: Request): Promise<Response> {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ valid: false, reason: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: WebhookRequest = await req.json();
    const { payload, signature, timestamp } = body;

    // Validate required fields
    if (!payload || !signature || !timestamp) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: 'Missing required fields: payload, signature, timestamp' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate timestamp
    if (!isTimestampValid(timestamp)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: 'Timestamp outside acceptable window (5 minutes)' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const payloadString = JSON.stringify(payload);
    const isValid = await verifySignature(payloadString, timestamp, signature);

    if (!isValid) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Success
    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook validation error:', error);
    return new Response(
      JSON.stringify({ valid: false, reason: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Vercel Edge Function configuration
export const config = {
  runtime: 'edge',
};