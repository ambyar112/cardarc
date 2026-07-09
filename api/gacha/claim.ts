/**
 * GACHA CLAIM BACKEND - SECURE MINT AUTHORIZATION
 *
 * NOTE: Primary production mint path is POST /api/gacha/mint (deployer mint).
 * This claim endpoint issues a voucher-style payload when SIGNER_* env is configured.
 * Never throw at module load — misconfig returns JSON 503 instead of FUNCTION_INVOCATION_FAILED.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withAuth } from '../_middleware/auth'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '5042002', 10)

function getConfig() {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY
  const ARC_CARDS_ADDRESS =
    process.env.ARC_CARDS_ADDRESS || process.env.VITE_CONTRACT_ADDRESS

  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY|SUPABASE_SERVICE_ROLE_KEY')
  if (!SIGNER_PRIVATE_KEY) missing.push('SIGNER_PRIVATE_KEY')
  if (!ARC_CARDS_ADDRESS) missing.push('ARC_CARDS_ADDRESS|VITE_CONTRACT_ADDRESS')

  return {
    ok: missing.length === 0,
    missing,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    SIGNER_PRIVATE_KEY,
    ARC_CARDS_ADDRESS,
  }
}

function getAdmin(): SupabaseClient | null {
  const cfg = getConfig()
  if (!cfg.ok) return null
  return createClient(cfg.SUPABASE_URL!, cfg.SUPABASE_SERVICE_KEY!)
}

async function verifyGachaPull(
  supabaseAdmin: SupabaseClient,
  wallet: string,
  cardId: string
): Promise<boolean> {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('gacha_log')
    .select('id')
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .gte('created_at', since)
    .limit(1)

  if (error) {
    console.error('Gacha pull verification error:', error)
    return false
  }
  return !!(data && data.length > 0)
}

async function isAlreadyClaimed(
  supabaseAdmin: SupabaseClient,
  wallet: string,
  cardId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('collection')
    .select('id')
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .limit(1)

  if (error) {
    console.error('Claim check error:', error)
    return false
  }
  return !!(data && data.length > 0)
}

async function markAsClaimed(
  supabaseAdmin: SupabaseClient,
  wallet: string,
  cardId: string,
  nonce: string
): Promise<boolean> {
  const { error } = await supabaseAdmin.from('claim_log').insert({
    wallet: wallet.toLowerCase(),
    card_id: cardId,
    nonce,
    claimed_at: new Date().toISOString(),
  })
  return !error
}

/**
 * Generate a deterministic claim attestation.
 * Prefer /api/gacha/mint for actual on-chain minting (deployer path).
 */
async function generateClaimSignature(
  cardId: string,
  wallet: string,
  nonce: string,
  contractAddress: string,
  signerKey: string
): Promise<string> {
  const message = {
    cardId,
    wallet: wallet.toLowerCase(),
    nonce,
    contractAddress,
    chainId: CHAIN_ID,
    timestamp: Date.now(),
  }
  const messageString = JSON.stringify(message)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signerKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(messageString))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const handler = async (wallet: string, body: any): Promise<Response> => {
  try {
    const cfg = getConfig()
    if (!cfg.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'Claim endpoint misconfigured',
          missing: cfg.missing,
          hint: 'Set SIGNER_PRIVATE_KEY + Supabase + ARC_CARDS_ADDRESS, or use POST /api/gacha/mint',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = getAdmin()
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Supabase unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { cardId, nonce } = body || {}

    if (!cardId || typeof cardId !== 'string' || cardId.length > 100) {
      return new Response(JSON.stringify({ success: false, reason: 'Invalid card ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!nonce || typeof nonce !== 'string' || !/^0x[0-9a-f]{64}$/i.test(nonce)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Invalid nonce format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (await isAlreadyClaimed(supabaseAdmin, wallet, cardId)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Card already claimed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const hasValidPull = await verifyGachaPull(supabaseAdmin, wallet, cardId)
    if (!hasValidPull) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'No valid gacha pull found. Pull a card first.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const signature = await generateClaimSignature(
      cardId,
      wallet,
      nonce,
      cfg.ARC_CARDS_ADDRESS!,
      cfg.SIGNER_PRIVATE_KEY!
    )

    await markAsClaimed(supabaseAdmin, wallet, cardId, nonce)

    return new Response(JSON.stringify({ success: true, signature }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Claim handler error:', error)
    return new Response(
      JSON.stringify({ success: false, reason: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export default withAuth(handler)

export const config = {
  runtime: 'edge',
}
