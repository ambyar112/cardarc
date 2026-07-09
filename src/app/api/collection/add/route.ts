import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase configuration required')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function isValidAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

function sanitizeText(str, maxLen = 200) {
  if (!str) return ''
  return String(str).replace(/[<>\"]/g, '').trim().slice(0, maxLen)
}

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
    const parsed = new URL(String(url))
    if (parsed.protocol !== 'https:') return null
    const isAllowed = ALLOWED_IMG_DOMAINS.some(
      d => parsed.hostname === d || parsed.hostname.endsWith('.' + d)
    )
    return isAllowed ? url : null
  } catch {
    return null
  }
}

function validateTier(tier) {
  const valid = new Set(['legendary', 'epic', 'rare', 'common'])
  return valid.has(tier) ? tier : 'common'
}

async function ensureProfileExists(wallet) {
  const normalizedWallet = wallet.toLowerCase()
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('wallet')
    .eq('wallet', normalizedWallet)
    .limit(1)

  if (existing && existing.length > 0) return true

  const { error } = await supabaseAdmin
    .from('profiles')
    .insert({
      wallet: normalizedWallet,
      level: 1,
      legendary_count: 0,
      arc_volume: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('Failed to create profile:', error)
    return false
  }

  return true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { wallet, card, nftTokenId } = req.body || {}

    if (!wallet || !card || !card.id || !card.name || !card.tier) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card data. Required: id, name, tier',
      })
    }

    if (!isValidAddress(wallet)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address' })
    }

    const profileCreated = await ensureProfileExists(wallet)
    if (!profileCreated) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create profile. FK constraint violation prevented.',
      })
    }

    const collectionData = {
      wallet: wallet.toLowerCase(),
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
    }

    const { error } = await supabaseAdmin
      .from('collection')
      .upsert(collectionData, {
        onConflict: 'wallet,card_id',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error('Collection upsert error:', error)
      return res.status(500).json({
        success: false,
        error: `Database error: ${error.message}`,
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Card added to collection successfully',
    })
  } catch (error) {
    console.error('Add to collection handler error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
