/**
 * ERC-1155 metadata for ArcCards
 * URI pattern: https://cardarc.vercel.app/api/metadata/{id}
 */

export const config = { runtime: 'edge' }

const RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'
const CONTRACT =
  process.env.VITE_CONTRACT_ADDRESS ||
  process.env.ARC_CARDS_ADDRESS ||
  '0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A'

// ethers.id("tokenIdToCard(uint256)").slice(0, 10)
const TOKEN_ID_TO_CARD_SELECTOR = '0xbed38df4'

function headers() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cache-Control': 'public, max-age=300, s-maxage=600',
  }
}

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
    })
    const json: any = await res.json()
    if (json.error || !json.result || json.result === '0x') return null
    return json.result as string
  } catch {
    return null
  }
}

function decodeAbiString(hex: string): string | null {
  try {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    if (h.length < 128) return null
    const offset = parseInt(h.slice(0, 64), 16) * 2
    const len = parseInt(h.slice(offset, offset + 64), 16)
    if (!Number.isFinite(len) || len <= 0 || len > 500) return null
    const dataHex = h.slice(offset + 64, offset + 64 + len * 2)
    let s = ''
    for (let i = 0; i < dataHex.length; i += 2) {
      const code = parseInt(dataHex.slice(i, i + 2), 16)
      if (!Number.isFinite(code) || code === 0) break
      s += String.fromCharCode(code)
    }
    return s || null
  } catch {
    return null
  }
}

async function resolveCardId(tokenId: bigint): Promise<string | null> {
  const data =
    TOKEN_ID_TO_CARD_SELECTOR + tokenId.toString(16).padStart(64, '0')
  const result = await ethCall(CONTRACT, data)
  if (!result) return null
  return decodeAbiString(result)
}

function gameFromCardId(cardId: string | null): string {
  if (!cardId) return 'unknown'
  if (cardId.startsWith('ygo-')) return 'yugioh'
  if (cardId.startsWith('dbs-')) return 'dragonball'
  return 'pokemon'
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headers() })
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: headers(),
    })
  }

  try {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    let rawId = parts[parts.length - 1] || '0'
    rawId = rawId.replace(/\.json$/i, '')

    if (!/^\d+$/.test(rawId)) {
      return new Response(JSON.stringify({ error: 'Invalid token id' }), {
        status: 400,
        headers: headers(),
      })
    }

    const tokenId = BigInt(rawId)
    const cardId = await resolveCardId(tokenId)
    const game = gameFromCardId(cardId)

    const metadata = {
      name: cardId ? `ArcCards · ${cardId}` : `ArcCards #${rawId}`,
      description: cardId
        ? `ArcCards collectible on Arc Testnet (chain 5042002). cardId=${cardId}, tokenId=${rawId}.`
        : `ArcCards collectible on Arc Testnet (chain 5042002). tokenId=${rawId}.`,
      image: 'https://cardarc.vercel.app/favicon.svg',
      external_url: 'https://cardarc.vercel.app/collection',
      attributes: [
        { trait_type: 'Token ID', value: Number(rawId) },
        { trait_type: 'Game', value: game },
        ...(cardId ? [{ trait_type: 'Card ID', value: cardId }] : []),
        { trait_type: 'Network', value: 'Arc Testnet' },
      ],
      properties: {
        tokenId: rawId,
        cardId: cardId || null,
        contract: CONTRACT,
        chainId: 5042002,
      },
    }

    return new Response(JSON.stringify(metadata, null, 2), {
      status: 200,
      headers: headers(),
    })
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'metadata failed', detail: e?.message || String(e) }),
      { status: 500, headers: headers() }
    )
  }
}
