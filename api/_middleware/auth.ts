/**
 * API Authentication Middleware
 * Verifies wallet signatures to prevent unauthorized access
 * Uses Edge Runtime (compatible with Vercel)
 */

import { verifyMessage } from 'ethers'

/**
 * Verify wallet signature from request body
 * Prevents unauthorized API access and replay attacks
 */
export async function verifyWalletSignature(
  body: any
): Promise<{ success: boolean; wallet?: string; error?: string }> {
  try {
    const { wallet, signature, message, timestamp } = body

    // Check required fields
    if (!wallet || !signature || !message || !timestamp) {
      return {
        success: false,
        error: 'Missing required auth fields: wallet, signature, message, timestamp',
      }
    }

    // Verify timestamp (prevent replay attacks)
    const now = Date.now()
    const age = now - timestamp

    if (age < 0) {
      return { success: false, error: 'Timestamp is in the future' }
    }

    if (age > 60000) {
      // 60 seconds
      return { success: false, error: 'Signature expired. Please sign again.' }
    }

    // Expected message format
    const expectedMessage = `Arc Cards Authentication\nWallet: ${wallet}\nTimestamp: ${timestamp}`

    if (message !== expectedMessage) {
      return {
        success: false,
        error: 'Invalid message format',
      }
    }

    // Verify signature
    const recoveredAddress = verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== wallet.toLowerCase()) {
      return {
        success: false,
        error: 'Signature verification failed',
      }
    }

    return { success: true, wallet: wallet.toLowerCase() }
  } catch (error: any) {
    console.error('Auth middleware error:', error)
    return {
      success: false,
      error: `Authentication failed: ${error.message || 'Unknown error'}`,
    }
  }
}

/**
 * Middleware wrapper for API endpoints (Edge Runtime)
 * Usage: export default withAuth(handler)
 * 
 * Handler receives verified wallet AND parsed body (body already consumed by auth)
 */
export function withAuth(
  handler: (wallet: string, body: any) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    // Allow OPTIONS for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200 })
    }

    try {
      // Parse body ONCE (Edge Runtime only allows single read)
      const body = await req.json()

      // Verify authentication
      const authResult = await verifyWalletSignature(body)

      if (!authResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: authResult.error,
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Check rate limit
      const rateLimit = checkRateLimit(authResult.wallet!)
      if (!rateLimit.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt! - Date.now()) / 1000)}s`,
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Call handler with verified wallet and parsed body
      return await handler(authResult.wallet!, body)
    } catch (error: any) {
      console.error('Handler error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}

/**
 * Rate limiting per wallet (simple in-memory implementation)
 * For production, consider using Vercel KV or Redis
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  wallet: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining?: number; resetAt?: number } {
  const now = Date.now()
  const key = wallet.toLowerCase()

  // Get or create rate limit entry
  let entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    // Create new window
    entry = { count: 0, resetAt: now + windowMs }
    rateLimitMap.set(key, entry)
  }

  // Check limit
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Increment counter
  entry.count++

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
export function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000)
}