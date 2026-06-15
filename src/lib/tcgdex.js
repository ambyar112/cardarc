// Pokemon TCG — TCGdex API (reliable, no rate limit, no CORS)
// Gambar: assets.tcgdex.net — clean, no watermark, no hotlink block
const BASE    = 'https://api.tcgdex.net/v2/en'
const CACHE_TTL = 1000 * 60 * 60 * 6 // 6 jam

export const SETS = [
  'swsh8','swsh12','swsh11','swsh10','swsh7',
  'sv02','sv04','sv08','sv01','sv03',
]

// ✅ FIX API-01: Sanitize third-party text to prevent XSS via poisoned API/cache
function sanitize(str, maxLen = 200) {
  if (!str) return ''
  return String(str).replace(/[<>"']/g, '').trim().slice(0, maxLen)
}

// ✅ FIX API-02: Validate image URL — only allow HTTPS from known domains
const ALLOWED_IMG_HOSTS = ['assets.tcgdex.net', 'images.ygoprodeck.com', 'www.dbs-cardgame.com',
  'raw.githubusercontent.com', 'exburst.dev', 'optcgapi.com', 'digimoncard.io', 'i.imgur.com']
function safeImg(url) {
  if (!url) return ''
  try {
    const p = new URL(url)
    if (p.protocol !== 'https:') return ''
    if (!ALLOWED_IMG_HOSTS.some(h => p.hostname === h || p.hostname.endsWith('.' + h))) return ''
    return url
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

export function rarityToTier(rarity = '') {
  const r = rarity.toLowerCase()
  if (r.includes('special illustration rare') || r.includes('hyper rare') ||
      r.includes('secret') || r.includes('rainbow rare') || r.includes('gold') ||
      r.includes('shiny') || r.includes('vmax')) return 'legendary'
  if (r.includes('illustration rare') || r.includes('ultra rare') ||
      r.includes('double rare') || r.includes('vstar') ||
      r.includes(' v') || r.includes('full art') || r.includes(' ex')) return 'epic'
  if (r.includes('holo') || r.includes('rare')) return 'rare'
  return 'common'
}
export function nameToTier(name = '') {
  const n = name.toLowerCase()
  if (n.includes('vmax')) return 'legendary'
  if (n.includes('vstar') || n.match(/ v$| v /) || n.includes(' ex') || n.includes('-ex')) return 'epic'
  if (n.includes(' gx') || n.includes('-gx') || n.includes(' radiant') || name.length > 14) return 'rare'
  return 'common'
}
export function tierToGlow(tier) {
  return { legendary:'glow-legendary', epic:'glow-epic', rare:'glow-rare', common:'glow-common' }[tier] || 'glow-common'
}
export function tierBadge(tier) {
  return {
    legendary: 'bg-secondary/20 text-secondary border-secondary/30',
    epic:      'bg-primary/20 text-primary border-primary/30',
    rare:      'bg-tertiary/20 text-tertiary border-tertiary/30',
    common:    'bg-white/10 text-on-surface border-white/10',
  }[tier] || 'bg-white/10 text-on-surface border-white/10'
}
export function tierBorder(tier) {
  return { legendary:'border-t-secondary', epic:'border-t-primary', rare:'border-t-tertiary', common:'border-t-outline' }[tier] || 'border-t-outline'
}
export function tierPrice(tier, base = 1) {
  return (base * ({ legendary:80, epic:30, rare:8, common:1 }[tier] || 1)).toFixed(0)
}

// Fetch set list (ringan, cepat) — gambar langsung dari URL pattern TCGdex
export async function fetchSetCards(setId) {
  const cacheKey = `pkm_set_${setId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const r = await fetch(`${BASE}/sets/${setId}`)
    const d = await r.json()
    if (!d.cards?.length) throw new Error('empty')

    // TCGdex image URL pattern: assets.tcgdex.net/en/{series}/{setId}/{localId}/high.webp
    const series = setId.startsWith('sv') ? 'sv' : 'swsh'
    const result = d.cards.map(c => ({
      id:      sanitize(c.id, 100),
      name:    sanitize(c.name),
      localId: sanitize(c.localId, 20),
      setId,
      img:     safeImg(c.image ? `${c.image}/high.webp` : `https://assets.tcgdex.net/en/${series}/${setId}/${c.localId}/high.webp`),
      tier:    nameToTier(c.name),
      rarity:  '',
      hp:      '—',
      types:   'Colorless',
      price:   null,
    }))

    setCache(cacheKey, result)
    return result
  } catch (e) {
    console.error('fetchSetCards error:', setId, e)
    return []
  }
}

// Tidak diperlukan lagi tapi disimpan untuk kompatibilitas
export async function fetchCardDetails(cards) {
  return cards
}
