// Dragon Ball Super Fusion World TCG
const RAW = 'https://raw.githubusercontent.com/apitcg/dragon-ball-fusion-tcg-data/main/cards/en'
const DBS_SETS = ['fb01', 'fb02', 'fb03', 'fb04', 'fb05', 'fb06']
const CACHE_TTL = 1000 * 60 * 60 * 6

function sanitize(str, maxLen = 200) {
  if (!str) return ''
  return String(str).replace(/[<>"']/g, '').trim().slice(0, maxLen)
}
function safeImg(url) {
  if (!url) return ''
  try {
    const p = new URL(url)
    if (p.protocol !== 'https:') return ''
    const allowed = ['www.dbs-cardgame.com', 'raw.githubusercontent.com']
    return allowed.some(h => p.hostname === h) ? url : ''
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

export function dbsRarityToTier(rarity = '', power = 0) {
  const r = rarity.toUpperCase()
  if (r === 'SPR') return 'legendary'
  if (r === 'SR' || r === 'L') return 'epic'
  if (r === 'R' || r === 'UC') return 'rare'
  return 'common'
}

export async function fetchDragonBallCards(color = null, limit = 60) {
  const cacheKey = `dbs_pool_${color || 'all'}`
  const cached = getCached(cacheKey)
  if (cached) return cached.sort(() => Math.random() - 0.5).slice(0, limit)

  try {
    // Ambil semua 6 set sekaligus supaya pool lebih besar
    const results = await Promise.all(
      DBS_SETS.map(s =>
        fetch(`${RAW}/${s}.json`).then(r => r.json()).catch(() => [])
      )
    )

    let allCards = results.flat().filter(c =>
      c.images?.small && c.name && !c.id.includes('-p')
    )

    if (color) {
      allCards = allCards.filter(c =>
        c.color && c.color.toLowerCase() === color.toLowerCase()
      )
    }

    const mapped = allCards.map(c => ({
      id:       `dbs-${sanitize(c.id, 50)}`,
      name:     sanitize(c.name),
      img:      safeImg(c.images?.large || c.images?.small || ''),
      tier:     dbsRarityToTier(c.rarity, parseInt(c.power) || 0),
      rarity:   sanitize(c.rarity || 'C', 10),
      hp:       sanitize(c.power || '—', 20),
      types:    sanitize(c.color || '—', 50),
      localId:  sanitize(c.code || c.id, 50),
      setId:    'dragonball',
      price:    null,
      power:    sanitize(c.power, 20),
      color:    sanitize(c.color, 50),
      cardType: sanitize(c.cardType || '', 50),
      features: sanitize(c.features || '', 200),
      effect:   sanitize(c.effect || '', 500),
      cost:     c.cost,
    }))

    setCache(cacheKey, mapped)
    return mapped.sort(() => Math.random() - 0.5).slice(0, limit)
  } catch (e) {
    console.error('Dragon Ball fetch error:', e)
    return []
  }
}
