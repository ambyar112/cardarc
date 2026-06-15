// Gundam Card Game
const API_BASE = 'https://api.deckplanet.net/cardsearch/gundam_cards'
const IMG_BASE = 'https://exburst.dev/gundam/cards/hd'
const CACHE_TTL = 1000 * 60 * 60 * 6

function sanitize(str, maxLen = 200) {
  if (!str) return ''
  return String(str).replace(/[<>"']/g, '').trim().slice(0, maxLen)
}
function safeImg(url) {
  if (!url) return ''
  try {
    const p = new URL(url)
    return p.protocol === 'https:' && p.hostname === 'exburst.dev' ? url : ''
  } catch { return '' }
}

// Filter hanya kartu base (bukan variant)
const BASE_FILTER = encodeURIComponent(JSON.stringify({
  _and: [
    { status: { _eq: 'published' } },
    { variant_of: { id: { _null: true } } }
  ]
}))

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

export function gundamRarityToTier(rarity = '') {
  const r = rarity.toUpperCase()
  if (r === 'LR+' || r === 'SR') return 'legendary'
  if (r === 'LR' || r === 'R')   return 'epic'
  if (r === 'U')                  return 'rare'
  return 'common'                 // C
}

export async function fetchGundamCards(color = null, limit = 60) {
  const cacheKey = `gundam_pool_${color || 'all'}`
  const cached = getCached(cacheKey)
  if (cached) return cached.sort(() => Math.random() - 0.5).slice(0, limit)

  try {
    // Ambil page 1 dan 2 sekaligus
    const [p1, p2, p3] = await Promise.all([
      fetch(`${API_BASE}?filter=${BASE_FILTER}&page=1`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}?filter=${BASE_FILTER}&page=2`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}?filter=${BASE_FILTER}&page=3`).then(r => r.json()).catch(() => ({ data: [] })),
    ])

    let allCards = [...(p1.data || []), ...(p2.data || []), ...(p3.data || [])]

    // Filter by color jika ada
    if (color) {
      allCards = allCards.filter(c =>
        c.card_color && c.card_color.toUpperCase() === color.toUpperCase()
      )
    }

    const mapped = allCards
      .filter(c => c.card_name && c.card_number && c.img_link)
      .map(c => ({
        id:        `gundam-${sanitize(String(c.card_number), 30)}`,
        name:      sanitize(c.card_name),
        img:       safeImg(`${IMG_BASE}/${sanitize(c.img_link, 80)}.webp`),
        tier:      gundamRarityToTier(c.card_rarity),
        rarity:    sanitize(c.card_rarity || 'C', 10),
        hp:        sanitize(c.card_hp || '—', 20),
        types:     sanitize(c.card_color || '—', 50),
        localId:   sanitize(c.card_number, 30),
        setId:     'gundam',
        price:     null,
        ap:        c.card_ap,
        cardHp:    c.card_hp,
        color:     sanitize(c.card_color, 50),
        cardType:  sanitize(c.card_type || '', 50),
        series:    sanitize(c.card_series || '', 100),
        source:    sanitize(c.card_source_title || '', 100),
        traits:    sanitize((c.card_traits || []).join(', '), 200),
      }))

    setCache(cacheKey, mapped)
    return mapped.sort(() => Math.random() - 0.5).slice(0, limit)
  } catch (e) {
    console.error('Gundam fetch error:', e)
    return []
  }
}
