/**
 * ═══════════════════════════════════════════════════════════════════════
 * COLLECTION ADD BACKEND - SECURE COLLECTION MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Backend endpoint that:
 *   1. Bypasses RLS using service role (admin access)
 *   2. Auto-creates profile if missing (fixes FK constraint)
 *   3. Upserts collection with proper conflict resolution
 *   4. Returns detailed error messages for debugging
 * 
 * Environment variables required:
 *   SUPABASE_URL - Service role URL
 *   SUPABASE_SERVICE_KEY - Service role key (admin access)
 * 
 * Deploy as Vercel Edge Function or Node serverless function.
 */

import { createClient } from '@supabase/supabase-js';
import { withAuth } from '../_middleware/auth';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Match Vercel env var name

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase configuration required');
}

// Admin Supabase client (service role - bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface AddToCollectionRequest {
  wallet: string;
  card: {
    id: string;
    name: string;
    img?: string;
    tier: string;
    setId?: string;
    localId?: string;
    hp?: string | number;
    types?: string;
    rarity?: string;
    atk?: number;
    def?: number;
    level?: number;
  };
  nftTokenId?: string | number | null;
}

interface AddToCollectionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Validate Ethereum address format.
 */
function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Sanitize string for safe DB insertion.
 */
function sanitizeText(str: any, maxLen: number = 200): string {
  if (!str) return '';
  return String(str)
    .replace(/[<>"]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Validate image URL - only HTTPS from known domains.
 */
const ALLOWED_IMG_DOMAINS = [
  'assets.tcgdex.net',
  'images.ygoprodeck.com',
  'www.dbs-cardgame.com',
  'raw.githubusercontent.com',
  'digimoncard.io',
  'exburst.dev',
  'optcgapi.com',
  'i.imgur.com',
];

function validateImgUrl(url: any): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return null;
    const isAllowed = ALLOWED_IMG_DOMAINS.some(
      d => parsed.hostname === d || parsed.hostname.endsWith('.' + d)
    );
    return isAllowed ? url : null;
  } catch {
    return null;
  }
}

/**
 * Validate tier value.
 */
const VALID_TIERS = new Set(['legendary', 'epic', 'rare', 'common']);
function validateTier(tier: string): string {
  return VALID_TIERS.has(tier) ? tier : 'common';
}

/**
 * Ensure profile exists for this wallet (fixes FK constraint issue).
 */
async function ensureProfileExists(wallet: string): Promise<boolean> {
  const normalizedWallet = wallet.toLowerCase();
  
  // Check if profile exists
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('wallet')
    .eq('wallet', normalizedWallet)
    .limit(1);
  
  if (existing && existing.length > 0) {
    return true; // Profile already exists
  }
  
  // Create profile
  const { error } = await supabaseAdmin
    .from('profiles')
    .insert({
      wallet: normalizedWallet,
      level: 1,
      legendary_count: 0,
      arc_volume: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error('Failed to create profile:', error);
    return false;
  }
  
  return true;
}

/**
 * Add card to collection with proper upsert logic.
 */
async function addCardToCollection(
  wallet: string,
  card: AddToCollectionRequest['card'],
  nftTokenId?: string | number | null
): Promise<{ success: boolean; error?: string }> {
  const normalizedWallet = wallet.toLowerCase();
  
  // Ensure profile exists first (fixes FK constraint)
  const profileCreated = await ensureProfileExists(normalizedWallet);
  if (!profileCreated) {
    return { 
      success: false, 
      error: 'Failed to create profile. FK constraint violation prevented.' 
    };
  }
  
  // Prepare collection data with nft_token_id (preserve if already set by mint API)
  const collectionData = {
    wallet: normalizedWallet,
    card_id: sanitizeText(card.id, 100),
    card_name: sanitizeText(card.name, 200),
    card_img: validateImgUrl(card.img),
    tier: validateTier(card.tier),
    set_id: sanitizeText(card.setId, 50) || null,
    local_id: sanitizeText(String(card.localId ?? ''), 50),
    hp: sanitizeText(String(card.hp ?? ''), 20),
    types: sanitizeText(card.types, 100) || null,
    rarity: sanitizeText(card.rarity, 100) || null,
    atk: card.atk != null ? Number(card.atk) : null,
    def: card.def != null ? Number(card.def) : null,
    level: card.level != null ? Number(card.level) : null,
    nft_token_id: nftTokenId != null ? Number(nftTokenId) : null,
  };
  
  // Upsert with conflict resolution on (wallet, card_id)
  const { error } = await supabaseAdmin
    .from('collection')
    .upsert(collectionData, { 
      onConflict: 'wallet,card_id',
      ignoreDuplicates: false // Update if exists
    });
  
  if (error) {
    console.error('Collection upsert error:', error);
    return { 
      success: false, 
      error: `Database error: ${error.message}` 
    };
  }
  
  return { success: true };
}

/**
 * Main handler - wrapped with auth middleware
 * Wallet signature is verified before reaching this handler
 */
const handler = async (wallet: string, body: any): Promise<Response> => {
  try {
    const { card, nftTokenId } = body;
    
    // Wallet is already verified and lowercase from auth middleware
    
    // Validate card data
    if (!card || !card.id || !card.name || !card.tier) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid card data. Required: id, name, tier' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Add to collection
    const result = await addCardToCollection(wallet, card, nftTokenId);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Success
    const response: AddToCollectionResponse = {
      success: true,
      message: 'Card added to collection successfully',
    };
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        } 
      }
    );
    
  } catch (error) {
    console.error('Add to collection handler error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Export handler wrapped with authentication middleware
export default withAuth(handler)

export const config = {
  runtime: 'edge',
};
