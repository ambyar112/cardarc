/**
 * SERVER-SIDE WEBHOOK VALIDATION API
 * Never throw at module load — return JSON 503 if WEBHOOK_SECRET missing.
 */

const TIMESTAMP_WINDOW = 5 * 60 * 1000 // 5 minutes

interface WebhookRequest {
  payload: Record<string, any>
  signature: string
  timestamp: string
}

function getSecret(): string | null {
  return process.env.WEBHOOK_SECRET || null
}

async function generateSignature(
  payload: string,
  timestamp: string,
  secret: string
): Promise<string> {
  const message = `${timestamp}.${payload}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifySignature(
  payload: string,
  timestamp: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await generateSignature(payload, timestamp, secret)
  if (signature.length !== expected.length) return false
  let result = 0
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return result === 0
}

function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) return false
  return Math.abs(Date.now() - ts) <= TIMESTAMP_WINDOW
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ valid: false, reason: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const secret = getSecret()
    if (!secret) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: 'Webhook endpoint misconfigured (WEBHOOK_SECRET missing)',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body: WebhookRequest = await req.json()
    const { payload, signature, timestamp } = body

    if (!payload || !signature || !timestamp) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: 'Missing required fields: payload, signature, timestamp',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!isTimestampValid(String(timestamp))) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: 'Timestamp outside acceptable window (5 minutes)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const payloadString = JSON.stringify(payload)
    const isValid = await verifySignature(payloadString, String(timestamp), signature, secret)

    if (!isValid) {
      return new Response(JSON.stringify({ valid: false, reason: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook validation error:', error)
    return new Response(JSON.stringify({ valid: false, reason: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  runtime: 'edge',
}
