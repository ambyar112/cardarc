const BASE = 'https://db.ygoprodeck.com/api/v7'
const CACHE_TTL = 1000 * 60 * 60 * 6

function sanitize(str, maxLen = 200) {
  if (!str) return ''
  return String(str).replace(/[<>"']/g, '').trim().slice(0, maxLen)
}
function safeImg(url) {
  if (!url) return ''
  try {
    const p = new URL(url)
    return p.protocol === 'https:' && p.hostname === 'images.ygoprodeck.com' ? url : ''
  } catch { return '' }
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null }
    return data
  } catch { return null }
}
function setCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

export function yugiohRarityToTier(card) {
  const name = card.name?.toLowerCase() || ''
  const type = card.type?.toLowerCase() || ''
  // Legendary: only true boss monsters
  // XYZ/Synchro/Fusion with ATK >= 3500, OR ATK >= 3500, OR level >= 12
  const isExtraType = type.includes('xyz') || type.includes('synchro') || type.includes('fusion')
  if ((isExtraType && card.atk >= 3500) || card.atk >= 3500 || card.level >= 12) return 'legendary'
  // Epic: Extra Deck monsters (any ATK), ritual/link/pendulum, high ATK/level
  if (isExtraType || type.includes('ritual') || type.includes('link') || type.includes('pendulum') ||
      card.atk >= 2600 || card.level >= 7) return 'epic'
  // Rare: mid-range
  if (card.atk >= 1600 || card.level >= 4) return 'rare'
  return 'common'
}

export async function fetchYugiohCards(type = 'random', limit = 30) {
  const cacheKey = `ygo_pool_${type}`
  const cached = getCached(cacheKey)
  if (cached) return cached.sort(() => Math.random() - 0.5).slice(0, limit)

  try {
    let url = `${BASE}/cardinfo.php?num=100&offset=${Math.floor(Math.random()*300)}`
    if (type === 'dark') url += '&attribute=DARK'
    if (type === 'dragon') url += '&type=Dragon'
    if (type === 'spellcaster') url += '&type=Spellcaster'

    const r = await fetch(url, { referrerPolicy: 'no-referrer' })
    const d = await r.json()
    const mapped = (d.data || []).map(c => ({
      id:       `ygo-${sanitize(String(c.id), 20)}`,
      name:     sanitize(c.name),
      img:      safeImg(c.card_images?.[0]?.image_url || ''),
      tier:     yugiohRarityToTier(c),
      rarity:   sanitize(c.type, 100),
      hp:       c.atk != null ? String(c.atk) : '—',
      types:    sanitize(c.attribute || c.race || '—', 50),
      localId:  c.id,
      setId:    'yugioh',
      price:    null,
      atk:      c.atk,
      def:      c.def,
      level:    c.level,
      desc:     sanitize(c.desc, 500),
    }))
    setCache(cacheKey, mapped)
    return mapped.sort(() => Math.random() - 0.5).slice(0, limit)
  } catch (e) {
    console.error('YuGiOh fetch error:', e)
    return []
  }
}
