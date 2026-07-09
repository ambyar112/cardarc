import { createClient } from '@supabase/supabase-js'
import { withAuth } from '../_middleware/auth.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase configuration required')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function sanitizeText(str: any, maxLen = 200): string {
  if (!str) return ''
  return String(str).replace(/[<>"]/g, '').trim().slice(0, maxLen)
}

function validateTier(tier: any): string {
  const valid = new Set(['legendary', 'epic', 'rare', 'common'])
  return valid.has(tier) ? tier : 'common'
}

function normalizeCard(raw: any) {
  if (!raw) return null
  if (Array.isArray(raw.cards)) return raw.cards.filter(Boolean)
  if (raw.card && typeof raw.card === 'object') return [raw.card]
  return null
}

async function addCardToCollection(wallet, card, nftTokenId) {
  const row = {
    wallet: wallet.toLowerCase(),
    card_id: sanitizeText(card.id, 100),
    card_name: sanitizeText(card.name, 200),
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
    .upsert(row, { onConflict: 'wallet,card_id', ignoreDuplicates: false })

  if (error) {
    return { success: false, error: `Database error: ${error.message}` }
  }
  return { success: true }
}

export default withAuth(
  async (wallet: string, body: any): Promise<Response> => {
    try {
      const cardsArray = normalizeCard(body)
      const { nftTokenId } = (body || {}) as any

      if (!cardsArray || !cardsArray.length) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid card data. Required: card object or cards[]',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      let last: any = { success: true }
      for (const c of cardsArray) {
        last = await addCardToCollection(wallet, c, nftTokenId)
        if (!last.success) break
      }

      if (!last.success) {
        return new Response(
          JSON.stringify({ success: false, error: last.error }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Cards added to collection successfully',
          count: cardsArray.length,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (err: any) {
      console.error('Add to collection handler error:', err)
      return new Response(
        JSON.stringify({ success: false, error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
)
