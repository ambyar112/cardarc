import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { withAuth } from '../_middleware/auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.VITE_CONTRACT_ADDRESS || process.env.ARC_CARDS_ADDRESS;
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '5042002');

function getMintConfig() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY|SUPABASE_SERVICE_ROLE_KEY');
  if (!DEPLOYER_PRIVATE_KEY) missing.push('DEPLOYER_PRIVATE_KEY|SIGNER_PRIVATE_KEY');
  if (!CONTRACT_ADDRESS) missing.push('VITE_CONTRACT_ADDRESS|ARC_CARDS_ADDRESS');
  return { ok: missing.length === 0, missing };
}

const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null as any;

const ARC_CARDS_ABI = [
  'function mintCard(address to, string calldata cardId) external',
  'function cardToTokenId(string calldata cardId) external view returns (uint256)',
  'function balanceOf(address account, uint256 tokenId) external view returns (uint256)',
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

async function upsertCollectionRecord(
  wallet: string,
  cardId: string,
  tokenId: number,
  tier: string,
  set_id: string
): Promise<boolean> {
  const cardNameMap: Record<string, string> = {
    'swsh8-123': 'Pikachu VMAX',
    'sv02-087': 'Charizard ex',
    'ygo-89631139': 'Blue-Eyes White Dragon',
    'ygo-46986414': 'Dark Magician',
    'dbs-bt1-001': 'Son Goku',
  };

  const cardName = cardNameMap[cardId] || cardId;

  // Auto-generate card_img from card_id/set_id (no hardcode needed)
  function buildCardImg(id: string, set: string): string {
    if (set === 'yugioh') {
      const num = id.replace(/^ygo-/, '')
      if (/^\d+$/.test(num)) return `/api/ygo-img?id=${num}`
    }
    if (set === 'pokemon') {
      // card_id like sv04-183 → https://assets.tcgdex.net/en/sv/sv04/183/high.webp
      const m = id.match(/^([a-z]+)(\d+)-(\d+)$/i)
      if (m) return `https://assets.tcgdex.net/en/${m[1].toLowerCase()}/${m[1].toLowerCase()}${m[2]}/${m[3]}/high.webp`
      // fallback for non-standard like swsh8-123
      const m2 = id.match(/^([a-z0-9]+)-(\d+)$/i)
      if (m2) {
        const g = m2[1].toLowerCase()
        return `https://assets.tcgdex.net/en/${g}/${g}${m2[2]}/high.webp`
      }
    }
    if (set === 'dragonball') {
      // best-effort dbs-cardgame pattern
      const m = id.match(/^dbs-(.+)$/i)
      if (m) return `https://www.dbs-cardgame.com/fw/images/cards/card/en/${m[1].toUpperCase()}.webp`
    }
    // fallback: local SVG placeholder (always renders)
    return `/api/card-img?name=${encodeURIComponent(cardName)}&set=${encodeURIComponent(set)}&tier=${encodeURIComponent(tier)}`
  }

  const safeTier = ['legendary','epic','rare','common'].includes(tier) ? tier : 'common';
  const safeSet = ['pokemon','yugioh','dragonball'].includes(set_id) ? set_id : 'pokemon';
  const cardImg = buildCardImg(cardId, safeSet);

  const { error } = await supabaseAdmin
    .from('collection')
    .upsert(
      {
        wallet: wallet.toLowerCase(),
        card_id: cardId,
        card_name: cardName,
        card_img: cardImg,
        tier: safeTier,
        set_id: safeSet,
        nft_token_id: tokenId,
        status: 'owned'
      },
      { onConflict: 'wallet,card_id', count: 'exact' }
    );

  if (error) {
    console.error('Collection upsert error:', error);
    return false;
  }
  return true;
}

function normalizeCardId(raw: string): { cardId: string; tier: string; set_id: string } {
  const c = raw.toLowerCase();
  if (c.startsWith('ygo-')) return { cardId: c, tier: 'epic', set_id: 'yugioh' };
  if (c.startsWith('dbs-')) return { cardId: c, tier: 'rare', set_id: 'dragonball' };
  if (c.includes('vmax') || c.includes('ex') || c.includes('legendary')) return { cardId: c, tier: 'legendary', set_id: 'pokemon' };
  return { cardId: c, tier: 'common', set_id: 'pokemon' };
}

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
    for (let i = 0; i < cardIds.length; i++) {
      const cardId = cardIds[i];
      const { cardId: normCardId, tier, set_id } = normalizeCardId(cardId);

      let existingTokenId: number | null = null;
      try {
        const tid = await contract.cardToTokenId(cardId);
        const tokenIdNum = Number(tid);
        if (tokenIdNum > 0) {
          try {
            const balanceNum = Number(await contract.balanceOf(wallet, tokenIdNum));
            if (balanceNum > 0) {
              await upsertCollectionRecord(wallet, cardId, tokenIdNum, tier, set_id);
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
        const tx = await contract.mintCard(wallet, cardId, { gasLimit: 500000 });
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
          results.push({ success: false, reason: 'Transaction failed' });
          continue;
        }
        let tokenId = 0;
        try { tokenId = Number(await contract.cardToTokenId(cardId)); } catch {}
        await upsertCollectionRecord(wallet, cardId, tokenId, tier, set_id);
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

export default withAuth(handler);
export const config = { runtime: 'edge' };
