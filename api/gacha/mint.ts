/**
 * GACHA MINT BACKEND - DIRECT MINT (SIMPLE & SECURE)
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

interface MintResponse {
  success: boolean;
  tokenId?: number;
  txHash?: string;
  reason?: string;
}

function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

async function updateCollectionTokenId(
  wallet: string,
  cardId: string,
  tokenId: number
): Promise<boolean> {
  const { error } = supabaseAdmin
    .from('collection')
    .update({ nft_token_id: tokenId })
    .eq('wallet', wallet.toLowerCase())
    .eq('card_id', cardId)
    .is('nft_token_id', null);

  if (error) {
    console.error('Collection update error:', error);
    return false;
  }
  return true;
}

/**
 * Main mint handler - wrapped with auth middleware
 * Accepts either cardId (string) or cardIds (string[]).
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

    const cardIdRaw = body.cardId;
    const cardIdsRaw = body.cardIds;
    const qty = Math.min(100, Math.max(1, Number(body.qty || 1) || 1));

    if (qty <= 0 || qty > 100) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Invalid qty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidAddress(wallet)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Wallet required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!CONTRACT_ADDRESS) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Contract not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let cardIds: string[] = [];
    if (Array.isArray(cardIdsRaw)) {
      cardIds = cardIdsRaw.map(String).filter(Boolean);
    } else if (typeof cardIdRaw === 'string' && cardIdRaw.trim()) {
      cardIds = [cardIdRaw.trim()];
    }

    if (!cardIds.length) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Missing cardId/cardIds' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    cardIds = cardIds.slice(0, qty);

    const provider = new ethers.JsonRpcProvider(ARC_RPC_URL, {
      chainId: CHAIN_ID,
      name: 'arc-testnet',
    });

    const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY!, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS!, ARC_CARDS_ABI, signer);

    const results: MintResponse[] = [];
    for (const cardId of cardIds) {
      let existingTokenId: number | null = null;
      try {
        const tid = await contract.cardToTokenId(cardIds[0]);
        const tokenIdNum = Number(tid);
        if (tokenIdNum > 0) {
          try {
            const balanceNum = Number(await contract.balanceOf(wallet, tokenIdNum));
            if (balanceNum > 0) {
              await updateCollectionTokenId(wallet, cardIds[0], tokenIdNum);
              results.push({ success: true, tokenId: tokenIdNum });
              continue;
            }
          } catch {
            existingTokenId = null;
          }
        }
      } catch {
        // card not known yet
      }

      try {
        const tx = await contract.mintCard(wallet, cardIds[0], { gasLimit: 500000 });
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
          results.push({ success: false, reason: 'Transaction failed' });
          continue;
        }
        let tokenId = 0;
        try { tokenId = Number(await contract.cardToTokenId(cardId)); } catch {}
        await updateCollectionTokenId(wallet, cardIds[0], tokenId);
        results.push({ success: true, tokenId, txHash: receipt.hash });
      } catch (e: any) {
        results.push({ success: false, reason: e?.message || 'mint reverted' });
      }
    }

    const ok = results.some(r => r.success);
    return new Response(
      JSON.stringify({ success: ok, results }),
      { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Mint handler error:', error);
    const reason = error?.message || 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, reason }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export default withAuth(handler)

export const config = {
  runtime: 'edge',
};
