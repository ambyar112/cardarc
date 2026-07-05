/**
 * ═══════════════════════════════════════════════════════════════════════
 * GACHA MINT BACKEND - DIRECT MINT (SIMPLE & SECURE)
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Backend endpoint that:
 *   1. Verifies user actually pulled gacha (checks gacha_log table)
 *   2. Uses DEPLOYER wallet to call mintCard() directly
 *   3. Returns tokenId to frontend
 * 
 * This is SIMPLER than signature-based approach and works immediately!
 * User never calls blockchain directly - backend does everything.
 * 
 * Environment variables required:
 *   SUPABASE_URL - Service role URL
 *   SUPABASE_SERVICE_KEY - Service role key (admin access)
 *   DEPLOYER_PRIVATE_KEY - Deployer/owner private key
 *   VITE_CONTRACT_ADDRESS - ArcCards contract address
 *   ARC_RPC_URL - ARC testnet RPC (https://rpc.testnet.arc.network)
 */

import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS || process.env.ARC_CARDS_ADDRESS;
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '5042002');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase configuration required');
}

if (!DEPLOYER_PRIVATE_KEY || !CONTRACT_ADDRESS) {
  throw new Error('Contract configuration required');
}

// Admin Supabase client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ArcCards ABI (minimal - just what we need)
const ARC_CARDS_ABI = [
  'function mintCard(address to, string calldata cardId) external',
  'function cardToTokenId(string calldata cardId) external view returns (uint256)',
];

interface MintRequest {
  wallet: string;
  cardId: string;
}

interface MintResponse {
  success: boolean;
  tokenId?: number;
  txHash?: string;
  reason?: string;
}

/**
 * Verify user owns this card in their collection (no time limit)
 */
async function verifyCardOwnership(wallet: string, cardId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('collection')
    .select('id')
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .limit(1);

  if (error) {
    console.error('Card ownership verification error:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Check if already minted - return existing tokenId if found
 */
async function getExistingMint(wallet: string, cardId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('collection')
    .select('nft_token_id')
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.nft_token_id ?? null;
}

/**
 * Save mint to collection table
 */
async function saveMintToCollection(
  wallet: string, 
  cardId: string, 
  tokenId: number
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('collection')
    .insert({
      wallet: wallet.toLowerCase(),
      card_id: cardId,
      nft_token_id: tokenId,
      quantity: 1,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Collection save error:', error);
    return false;
  }

  return true;
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Main mint handler - mints card using deployer wallet
 */
export default async function handler(req: Request): Promise<Response> {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, reason: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: MintRequest = await req.json();
    const { wallet, cardId } = body;

    // Validate input
    if (!wallet || !isValidAddress(wallet)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Invalid wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!cardId || typeof cardId !== 'string' || cardId.length > 100) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Invalid card ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Setup blockchain connection FIRST (need it for queries)
    const provider = new ethers.JsonRpcProvider(ARC_RPC_URL, {
      chainId: CHAIN_ID,
      name: 'arc-testnet',
    });

    const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY!, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS!, ARC_CARDS_ABI, signer);

    // Check if already minted - query BLOCKCHAIN first!
    let existingTokenId: number | null = null;
    
    try {
      const tid = await contract.cardToTokenId(cardId);
      const tokenIdNum = Number(tid);
      if (tokenIdNum > 0) {
        existingTokenId = tokenIdNum;
        console.log('Card already minted on blockchain, tokenId:', existingTokenId);
      }
    } catch (e) {
      console.log('Blockchain query error (might not be minted yet):', e);
    }

    // If found on blockchain, return existing tokenId
    if (existingTokenId !== null && existingTokenId > 0) {
      // Also save to DB if missing
      await saveMintToCollection(wallet, cardId, existingTokenId);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          tokenId: existingTokenId,
          reason: 'Already minted (returned existing tokenId from blockchain)'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Not on blockchain yet - verify user owns this card
    const ownsCard = await verifyCardOwnership(wallet, cardId);
    if (!ownsCard) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'Card not found in your collection.' 
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Minting card:', cardId, 'to:', wallet);

    // Call mintCard - this is where the actual minting happens!
    const tx = await contract.mintCard(wallet, cardId, {
      gasLimit: 500000, // Explicit gas limit
    });

    console.log('Mint tx sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    console.log('Mint tx confirmed:', receipt.hash);

    // Get tokenId from contract
    let tokenId: number;
    try {
      const tid = await contract.cardToTokenId(cardId);
      tokenId = Number(tid);
    } catch (e) {
      console.error('Failed to get tokenId:', e);
      tokenId = 0; // Fallback
    }

    // Save to collection table
    const saved = await saveMintToCollection(wallet, cardId, tokenId);
    if (!saved) {
      console.error('Failed to save to collection, but mint succeeded');
    }

    // Success!
    const response: MintResponse = {
      success: true,
      tokenId,
      txHash: receipt.hash,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Mint handler error:', error);
    
    // Return detailed error for debugging
    let reason = 'Internal server error';
    if (error.message) {
      reason = error.message;
    }
    if (error.reason) {
      reason = error.reason;
    }

    return new Response(
      JSON.stringify({ success: false, reason }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = {
  runtime: 'edge',
};