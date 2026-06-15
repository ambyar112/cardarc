// One Piece TCG — optcgapi.com
const BASE = 'https://optcgapi.com/api/sets/card'
const CACHE_TTL = 1000 * 60 * 60 * 6

// ✅ FIX API-04: Safe image URL parser — replaces fragile Markdown-style parsing
function sanitize(str, maxLen = 200) {
  if (!str) return ''
  return String(str).replace(/[<>"']/g, '').trim().slice(0, maxLen)
}
function safeImg(rawUrl) {
  if (!rawUrl) return ''
  try {
    // Handle Markdown-style "(url)" format from optcgapi
    let url = rawUrl
    const mdMatch = rawUrl.match(/\((.+?)\)/)
    if (mdMatch) url = mdMatch[1]
    const parsed = new URL(url)
    // Only allow HTTPS from optcgapi or trusted CDNs
    if (parsed.protocol !== 'https:') return ''
    const allowed = ['optcgapi.com', 'images.optcg.net', 'cdn.optcg.net']
    if (!allowed.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) return ''
    return parsed.href
  } catch {
    return ''
  }
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

// Set OP dengan jumlah kartu per set
const OP_SETS = [
  { id: 'OP01', count: 120 }, // Romance Dawn
  { id: 'OP02', count: 121 }, // Paramount War
  { id: 'OP03', count: 122 }, // Pillars of Strength
  { id: 'OP04', count: 122 }, // Kingdoms of Intrigue
  { id: 'OP05', count: 122 }, // Awakening of the New Era
  { id: 'OP06', count: 122 }, // Wings of the Captain
]

export function opRarityToTier(rarity = '', power = 0) {
  const r = rarity.toUpperCase()
  if (r === 'SEC')             return 'legendary' // Secret Rare
  if (r === 'SP' || r === 'SR') return 'legendary'
  if (r === 'L' || r === 'R')   return 'epic'     // Leader / Rare
  if (r === 'UC')               return 'rare'     // Uncommon
  return 'common'
}

// Generate random card IDs dari set tertentu
function randomIds(setId, count, total) {
  const ids = new Set()
  while (ids.size < count) {
    const n = Math.floor(Math.random() * total) + 1
    ids.add(`${setId}-${String(n).padStart(3, '0')}`)
  }
  return [...ids]
}

export async function fetchOnePieceCards(color = null, limit = 60) {
  const cacheKey = `op_pool_${color || 'all'}`
  const cached = getCached(cacheKey)
  if (cached) return cached.sort(() => Math.random() - 0.5).slice(0, limit)

  try {
    // Pilih 3 set random
    const sets = OP_SETS.sort(() => Math.random() - 0.5).slice(0, 3)

    // Generate 7 random card IDs per set = 21 requests total
    const allIds = sets.flatMap(s => randomIds(s.id, 7, s.count))

    // Fetch semua paralel
    const results = await Promise.all(
      allIds.map(id =>
        fetch(`${BASE}/${id}/`)
          .then(r => r.json())
          .catch(() => [])
      )
    )

    // Flatten — ambil kartu pertama dari setiap hasil (skip parallel/alternate art)
    let allCards = results
      .flat()
      .filter(c =>
        c.card_image &&
        c.card_name &&
        c.card_type !== 'DON!!' &&
        !c.card_name.includes('Parallel') &&
        !c.card_name.includes('Alternate Art') &&
        !c.card_name.includes('Manga') &&
        !c.card_name.includes('Reprint')
      )

    // Filter by color jika ada
    if (color) {
      allCards = allCards.filter(c =>
        c.card_color && c.card_color.toLowerCase().includes(color.toLowerCase())
      )
    }

    // Deduplicate by card_set_id
    const seen = new Set()
    allCards = allCards.filter(c => {
      if (seen.has(c.card_set_id)) return false
      seen.add(c.card_set_id)
      return true
    })

    const mapped = allCards.map(c => ({
      id:       `op-${sanitize(c.card_set_id, 30)}`,
      name:     sanitize(c.card_name.replace(/\s*\(\d+\)$/, '')), // strip "(001)" suffix + sanitize
      img:      safeImg(c.card_image),
      tier:     opRarityToTier(c.rarity, parseInt(c.card_power) || 0),
      rarity:   sanitize(c.rarity || 'C', 10),
      hp:       sanitize(c.card_power || '—', 20),
      types:    sanitize(c.card_color || '—', 50),
      localId:  sanitize(c.card_set_id, 30),
      setId:    'onepiece',
      price:    null, // don't trust client-side price from third-party
      power:    sanitize(c.card_power, 20),
      color:    sanitize(c.card_color, 50),
      cardType: sanitize(c.card_type || '', 50),
      opType:   sanitize(c.card_type || '', 50),
      cost:     c.card_cost,
      life:     c.life,
      setName:  sanitize(c.set_name, 100),
    }))

    setCache(cacheKey, mapped)
    return mapped.sort(() => Math.random() - 0.5).slice(0, limit)
  } catch (e) {
    console.error('One Piece fetch error:', e)
    return []
  }
}
