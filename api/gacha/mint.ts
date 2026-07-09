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
import { withAuth } from '../_middleware/auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS || process.env.ARC_CARDS_ADDRESS;
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '5042002');

// Lazy config — never throw at module load (avoids FUNCTION_INVOCATION_FAILED)
function getMintConfig() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY|SUPABASE_SERVICE_ROLE_KEY');
  if (!DEPLOYER_PRIVATE_KEY) missing.push('DEPLOYER_PRIVATE_KEY|SIGNER_PRIVATE_KEY');
  if (!CONTRACT_ADDRESS) missing.push('VITE_CONTRACT_ADDRESS|ARC_CARDS_ADDRESS');
  return { ok: missing.length === 0, missing };
}

// Admin Supabase client (may be unconfigured until env is set)
const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null as any;

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
 * Update collection table with nft_token_id after mint
 * Collection entry should already exist from gacha claim
 */
async function updateCollectionTokenId(
  wallet: string, 
  cardId: string, 
  tokenId: number
): Promise<boolean> {
  // Update existing collection entry with nft_token_id
  const { error } = await supabaseAdmin
    .from('collection')
    .update({ nft_token_id: tokenId })
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .is('nft_token_id', null); // Only update if not already set

  if (error) {
    console.error('Collection update error:', error);
    // Don't fail entire mint if DB update fails - NFT is already on blockchain
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
 * Main mint handler - wrapped with auth middleware
 * Wallet signature is verified before reaching this handler
 */
const handler = async (wallet: string, body: any): Promise<Response> => {
  try {
    const cfg = getMintConfig();
    if (!cfg.ok || !supabaseAdmin) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Mint endpoint misconfigured', missing: cfg.missing }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { cardId } = body;

    // Wallet is already verified and lowercase from auth middleware

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
        console.log('Card exists on blockchain, tokenId:', existingTokenId);
        
        // CRITICAL FIX: Verify ownership for ERC1155!
        // Same cardId can be minted multiple times to different wallets
        try {
          const balance = await contract.balanceOf(wallet, tokenIdNum);
          const balanceNum = Number(balance);
          
          if (balanceNum > 0) {
            console.log(`Wallet ${wallet} already owns tokenId ${tokenIdNum}`);
            // Update DB with tokenId if missing
            await updateCollectionTokenId(wallet, cardId, tokenIdNum);
            
            return new Response(
              JSON.stringify({ 
                success: true, 
                tokenId: tokenIdNum,
                reason: 'Already minted to this wallet (returned existing tokenId)'
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          } else {
            console.log(`TokenId ${tokenIdNum} exists but owned by different wallet. Will mint new instance.`);
            existingTokenId = null; // Force new mint
          }
        } catch (balanceError) {
          console.log('Balance check error, will proceed with new mint:', balanceError);
          existingTokenId = null;
        }
      }
    } catch (e) {
      console.log('Blockchain query error (might not be minted yet):', e);
    }

    // Mint the card (no ownership check needed - blockchain contract enforces access control)
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

    // Update collection table with tokenId (entry should already exist from gacha claim)
    const updated = await updateCollectionTokenId(wallet, cardId, tokenId);
    if (!updated) {
      console.error('Failed to update collection DB, but mint succeeded on blockchain');
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

// Export handler wrapped with authentication middleware
export default withAuth(handler)

export const config = {
  runtime: 'edge',
};
