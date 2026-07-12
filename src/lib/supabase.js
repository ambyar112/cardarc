import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ─── Security helpers ─────────────────────────────────────────

/** Normalize wallet to lowercase — prevents case-mismatch bugs */
function normalizeWallet(wallet) {
  if (!wallet || typeof wallet !== 'string') throw new Error('Invalid wallet address')
  return wallet.toLowerCase()
}

/** Sanitize string for safe DB insertion — strip HTML/script tags */
function sanitizeText(str, maxLen = 200) {
  if (!str) return ''
  return String(str)
    .replace(/[<>"]/g, '')       // strip XSS chars
    .trim()
    .slice(0, maxLen)
}

/** Validate image URL — only allow HTTPS from known safe domains */
const ALLOWED_IMG_DOMAINS = [
  'assets.tcgdex.net',
  'images.ygoprodeck.com',
  'www.dbs-cardgame.com',
  'raw.githubusercontent.com',
  'digimoncard.io',
  'exburst.dev',
  'optcgapi.com',
  'i.imgur.com',
]
function validateImgUrl(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    const isAllowed = ALLOWED_IMG_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))
    return isAllowed ? url : null
  } catch {
    return null
  }
}

/** Validate tier value */
const VALID_TIERS = new Set(['legendary', 'epic', 'rare', 'common'])
function validateTier(tier) {
  return VALID_TIERS.has(tier) ? tier : 'common'
}

// ─── Collection ───────────────────────────────────────────────

export async function getCollection(wallet) {
  const { data } = await supabase
    .from('collection')
    .select('*')
    .eq('wallet', normalizeWallet(wallet))
    .order('created_at', { ascending: false })
  return data || []
}

/**
 * Authenticated collection read (bypasses RLS issues by using backend service_role).
 * @param {import('viem').WalletClient} walletClient
 * @param {string} wallet
 */
export async function getMyCollection(walletClient, wallet) {
  try {
    const result = await callAuthenticatedAPI(walletClient, '/api/collection', { wallet: normalizeWallet(wallet) })
    if (result?.success && Array.isArray(result.data)) return result.data
    return []
  } catch (e) {
    console.error('getMyCollection error:', e)
    return []
  }
}

/**
 * Authenticated profile read.
 * @param {import('viem').WalletClient} walletClient
 * @param {string} wallet
 */
export async function getMyProfile(walletClient, wallet) {
  try {
    const result = await callAuthenticatedAPI(walletClient, '/api/profile', { wallet: normalizeWallet(wallet) })
    return result?.data || null
  } catch (e) {
    console.error('getMyProfile error:', e)
    return null
  }
}

export async function addToCollection(wallet, card, nftTokenId = null) {
  try {
    // Call backend API endpoint instead of direct Supabase
    // This bypasses RLS and handles profile creation automatically
    const response = await fetch('/api/collection/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: normalizeWallet(wallet),
        card: {
          id: card.id,
          name: card.name,
          img: card.img,
          tier: card.tier,
          setId: card.setId,
          localId: card.localId,
          hp: card.hp,
          types: card.types,
          rarity: card.rarity,
          atk: card.atk,
          def: card.def,
          level: card.level,
        },
        nftTokenId,
      }),
    })
    
    const result = await response.json()
    
    if (!result.success) {
      console.error('addToCollection API error:', result.error)
      return false
    }
    
    return true
  } catch (e) {
    console.error('addToCollection exception:', e)
    return false
  }
}

// ─── Gacha log ────────────────────────────────────────────────

export async function logPull(wallet, card, qty) {
  const safeQty = Math.min(Math.max(1, Number(qty) || 1), 10)
  const { error } = await supabase.from('gacha_log').insert({
    wallet:    normalizeWallet(wallet),
    card_id:   sanitizeText(card.id, 100),
    card_name: sanitizeText(card.name, 200),
    tier:      validateTier(card.tier),
    qty:       safeQty,
  })
  if (error) console.error('logPull error:', error.message)
}

export async function getGachaLog(wallet, limit = 20) {
  const safeLimit = Math.min(Math.max(1, Number(limit)), 100)
  const { data } = await supabase
    .from('gacha_log')
    .select('*')
    .eq('wallet', normalizeWallet(wallet))
    .order('created_at', { ascending: false })
    .limit(safeLimit)
  return data || []
}

// ─── Faucet ───────────────────────────────────────────────────

export async function getFaucetClaims(limit = 10) {
  const { data } = await supabase
    .from('faucet_claims')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function claimFaucet(wallet) {
  // Rate limit is ALSO enforced by the DB RLS policy (defense in depth)
  // This client-side check gives a friendly UX error before hitting the DB
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('faucet_claims')
    .select('id')
    .eq('wallet', normalizeWallet(wallet))
    .gte('created_at', since)
    .limit(1)
  if (recent?.length) {
    return { success: false, error: 'Cooldown 24 jam belum habis.' }
  }
  const { error } = await supabase
    .from('faucet_claims')
    .insert({ wallet: normalizeWallet(wallet), amount: 100 })
  // If DB policy blocked the insert, we get a permission error here too
  return error
    ? { success: false, error: 'Gagal claim. Coba lagi.' }
    : { success: true }
}

// ─── Profile / Leaderboard ────────────────────────────────────

export async function getLeaderboard() {
  const { data } = await supabase
    .from('profiles')
    .select('wallet, username, level, legendary_count, arc_volume')
    .order('legendary_count', { ascending: false })
    .limit(20)
  return data || []
}

export async function upsertProfile(wallet, updates) {
  // Sanitize username on client as extra defense; DB constraint is the real gate
  const safeUpdates = { ...updates }
  if (safeUpdates.username !== undefined) {
    safeUpdates.username = safeUpdates.username
      ? safeUpdates.username.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 20) || null
      : null
  }
  await supabase.from('profiles').upsert({
    wallet: normalizeWallet(wallet),
    ...safeUpdates,
    updated_at: new Date().toISOString(),
  })
}

// ─── Global stats ─────────────────────────────────────────────

export async function getGlobalStats() {
  try {
    // ✅ PERF FIX: use count aggregate only — no longer fetching 10000 rows to browser
    const [legendaryRes, totalRes, activeWalletsRes] = await Promise.all([
      supabase
        .from('gacha_log')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'legendary'),
      supabase
        .from('gacha_log')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('gacha_log')
        .select('wallet')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
        .limit(500),
    ])

    const totalCards    = totalRes.count || 0
    const uniqueWallets = new Set(activeWalletsRes.data?.map(r => r.wallet) || []).size
    const arcVolume     = totalCards * 6.67

    return {
      cardsSummoned:  totalCards,
      activeTraders:  uniqueWallets,
      arcVolume,
      legendaryPulls: legendaryRes.count || 0,
    }
  } catch (e) {
    console.error('getGlobalStats error:', e)
    return { cardsSummoned: 0, activeTraders: 0, arcVolume: 0, legendaryPulls: 0 }
  }
}

// ─── Activity feed ────────────────────────────────────────────

export async function getRecentActivity(limit = 30) {
  const { data } = await supabase
    .from('gacha_log')
    .select('wallet, card_id, card_name, tier, qty, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100))
  return data || []
}

// ─── Real leaderboard (aggregated server-side via RPC if possible) ──

export async function getRealLeaderboard(limit = 20) {
  // Fetch a reasonable cap — not 2000 rows
  const { data } = await supabase
    .from('gacha_log')
    .select('wallet, tier, qty')
    .order('created_at', { ascending: false })
    .limit(500)

  if (!data?.length) return []

  const map = {}
  for (const row of data) {
    const w = row.wallet
    if (!map[w]) map[w] = { wallet: w, totalPulls: 0, legendaryCount: 0, arcVolume: 0 }
    const qty = row.qty || 1
    map[w].totalPulls    += qty
    map[w].arcVolume     += qty * 6.67
    if (row.tier === 'legendary') map[w].legendaryCount += qty
  }

  const wallets = Object.keys(map)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('wallet, username, level')
    .in('wallet', wallets.slice(0, 50))

  const profileMap = {}
  for (const p of profiles || []) profileMap[p.wallet] = p

  return Object.values(map)
    .sort((a, b) => b.legendaryCount - a.legendaryCount || b.totalPulls - a.totalPulls)
    .slice(0, limit)
    .map(r => ({
      ...r,
      username:       profileMap[r.wallet]?.username || null,
      level:          profileMap[r.wallet]?.level || 1,
      arc_volume:     Math.round(r.arcVolume),
      legendary_count: r.legendaryCount,
    }))
}

export async function getExplorerFeed(limit = 20) {
  const { data } = await supabase
    .from('gacha_log')
    .select('id, wallet, card_id, card_name, tier, qty, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 50))
  return data || []
}

// ─── Marketplace Supabase sync ────────────────────────────────
// Source of truth = on-chain. Supabase = fast metadata cache only.

// Price bounds: enforce reasonable limits client-side as defense in depth.
// Server contract is the real gate, but we reject obviously bad values here.
const PRICE_MIN = 0.001    // minimum listing price in USDC
const PRICE_MAX = 1000000  // maximum listing price (1M USDC)

function validatePrice(price) {
  const p = Number(price)
  if (!Number.isFinite(p)) throw new Error('Invalid price: not a number')
  if (p < PRICE_MIN) throw new Error(`Price too low: minimum ${PRICE_MIN} USDC`)
  if (p > PRICE_MAX) throw new Error(`Price too high: maximum ${PRICE_MAX} USDC`)
  // Round to 2 decimals to match DB numeric(20, 2)
  return Math.round(p * 100) / 100
}

function validateOnChainId(id) {
  if (id == null) return null
  const n = Number(id)
  if (!Number.isInteger(n) || n < 0) throw new Error('Invalid on-chain listing ID')
  return n
}

export async function saveListingToSupabase(listing) {
  try {
    const safePrice = validatePrice(listing.priceEth)
    const safeOnChainId = validateOnChainId(listing.listingId)
    const { error } = await supabase.from('marketplace_listings').insert({
      on_chain_listing_id: safeOnChainId,
      seller:     normalizeWallet(listing.seller),
      card_id:    sanitizeText(listing.cardId, 100),
      card_name:  sanitizeText(listing.cardName || listing.cardId, 200),
      card_img:   validateImgUrl(listing.cardImg),
      tier:       validateTier(listing.tier),
      set_id:     sanitizeText(listing.setId, 50) || null,
      price_usdc: safePrice,
      price_wei:  BigInt(Math.floor(safePrice * 1e18)).toString(),
      status:     'active',
      buyer:      null,
    })
    if (error) console.error('saveListingToSupabase:', error.message)
    return !error
  } catch (e) {
    console.error('saveListingToSupabase validation:', e.message)
    return false
  }
}

export async function markListingSold(onChainListingId, buyerWallet) {
  await supabase
    .from('marketplace_listings')
    .update({ status: 'sold', buyer: normalizeWallet(buyerWallet) })
    .eq('on_chain_listing_id', validateOnChainId(onChainListingId))
    .eq('status', 'active')
}

export async function markListingCancelled(onChainListingId) {
  await supabase
    .from('marketplace_listings')
    .update({ status: 'cancelled' })
    .eq('on_chain_listing_id', validateOnChainId(onChainListingId))
    .eq('status', 'active')
}

export async function getActiveListingsFromSupabase(limit = 50) {
  const { data } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100))
  return data || []
}

export async function getMarketplaceHistory(limit = 30) {
  const { data } = await supabase
    .from('marketplace_listings')
    .select('*')
    .in('status', ['sold', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100))
  return data || []
}

export async function getMyListings(wallet) {
  const { data } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('seller', normalizeWallet(wallet))
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  return data || []
}
