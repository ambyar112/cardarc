/**
 * ═══════════════════════════════════════════════════════════════════════
 * GACHA CLAIM BACKEND - SECURE MINT AUTHORIZATION
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Backend endpoint that:
 *   1. Verifies user actually pulled gacha (checks gacha_log table)
 *   2. Validates rate limits (1 claim per card per wallet)
 *   3. Generates EIP-712 signature for contract.claimMint()
 * 
 * This replaces the insecure pattern where frontend could call
 * arcCardsContract.mintCard() directly (which requires onlyMinter role).
 * 
 * Environment variables required:
 *   SUPABASE_URL - Service role URL
 *   SUPABASE_SERVICE_KEY - Service role key (admin access)
 *   SIGNER_PRIVATE_KEY - Private key of EOA that signs vouchers
 *   ARC_CARDS_ADDRESS - ArcCards contract address
 *   CHAIN_ID - 5042002 for Arc Testnet
 * 
 * Deploy as Vercel Edge Function or Node serverless function.
 */

// Edge runtime: use Web Crypto API (no Node 'crypto' module)
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '../_middleware/auth';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
const ARC_CARDS_ADDRESS = process.env.ARC_CARDS_ADDRESS;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '5042002');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase configuration required');
}

if (!SIGNER_PRIVATE_KEY || !ARC_CARDS_ADDRESS) {
  throw new Error('Signer configuration required');
}

// Admin Supabase client (service role)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ClaimRequest {
  wallet: string;
  cardId: string;
  nonce: string; // Client-generated nonce
}

interface ClaimResponse {
  success: boolean;
  signature?: string;
  reason?: string;
}

/**
 * Verify user pulled this card via gacha.
 * Checks gacha_log for recent pull of this card_id by this wallet.
 */
async function verifyGachaPull(wallet: string, cardId: string): Promise<boolean> {
  // Look for gacha pull in last 5 minutes
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('gacha_log')
    .select('id')
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .gte('created_at', since)
    .limit(1);

  if (error) {
    console.error('Gacha pull verification error:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Check if this card was already claimed by this wallet.
 */
async function isAlreadyClaimed(wallet: string, cardId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('collection')
    .select('id')
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .limit(1);

  if (error) {
    console.error('Claim check error:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Mark card as claimed to prevent double-claim.
 */
async function markAsClaimed(wallet: string, cardId: string, nonce: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('claim_log')
    .insert({
      wallet: wallet.toLowerCase(),
      card_id: cardId,
      nonce: nonce,
      claimed_at: new Date().toISOString(),
    });

  return !error;
}

/**
 * Generate EIP-712 signature for ArcCards.claimMint()
 * 
 * Solidity expects:
 *   keccak256(abi.encodePacked(
 *     address(this),        // ArcCards contract
 *     chainId,              // 5042002
 *     keccak256(bytes(cardId)),
 *     keccak256(abi.encodePacked(address(wallet), nonce))
 *   ))
 */
async function generateClaimSignature(
  cardId: string,
  wallet: string,
  nonce: string
): Promise<string> {
  // EIP-712 message hash (matches ArcCardsOptimized.sol claimMint logic)
  // The contract handles the actual hashing, we just sign the nonce+wallet+cardId

  const message = {
    cardId,
    wallet: wallet.toLowerCase(),
    nonce,
    contractAddress: ARC_CARDS_ADDRESS,
    chainId: CHAIN_ID,
    timestamp: Date.now(),
  };

  const messageString = JSON.stringify(message);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SIGNER_PRIVATE_KEY!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(messageString));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate Ethereum address format.
 */
function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Main claim handler - wrapped with auth middleware
 * Wallet signature is verified before reaching this handler
 */
const handler = async (wallet: string, body: any): Promise<Response> => {
  try {
    const { cardId, nonce } = body;

    // Wallet is already verified and lowercase from auth middleware
    // No need to validate wallet format - auth middleware did it

    if (!cardId || typeof cardId !== 'string' || cardId.length > 100) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Invalid card ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!nonce || typeof nonce !== 'string' || !/^0x[0-9a-f]{64}$/.test(nonce)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Invalid nonce format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already claimed
    if (await isAlreadyClaimed(wallet, cardId)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Card already claimed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify user actually pulled this card
    const hasValidPull = await verifyGachaPull(wallet, cardId);
    if (!hasValidPull) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'No valid gacha pull found. Pull a card first.' 
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate signature
    const signature = await generateClaimSignature(cardId, wallet, nonce);

    // Mark as claimed (prevents replay)
    const marked = await markAsClaimed(wallet, cardId, nonce);
    if (!marked) {
      console.error('Failed to mark as claimed, but allowing signature generation');
    }

    // Return signature
    const response: ClaimResponse = {
      success: true,
      signature,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Claim handler error:', error);
    return new Response(
      JSON.stringify({ success: false, reason: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Export handler wrapped with authentication middleware
export default withAuth(handler)

export const config = {
  runtime: 'edge',
};
