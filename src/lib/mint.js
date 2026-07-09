// NFT Minting — ArcCards ERC-1155 (Backend Mint Flow - SECURE)
// Calls authenticated backend API which mints using deployer wallet.
// Requires wallet signature (apiClient) — bare {wallet, cardId} is rejected with 401.
import { callAuthenticatedAPI } from './apiClient'

/**
 * Mint 1 card via backend API — returns tokenId
 * @param {string} address - connected wallet (must match walletClient)
 * @param {{ id: string }} card
 * @param {import('viem').WalletClient} walletClient - required for EIP-191 auth
 */
export async function mintCardNFT(address, card, walletClient) {
  try {
    if (!address) throw new Error('Wallet not connected')
    if (!walletClient) {
      throw new Error('Wallet client required for signed mint. Connect wallet and try again.')
    }
    if (!card?.id) throw new Error('Invalid card')

    const cardId = card.id
    console.log('Calling authenticated backend mint API for:', cardId)

    const data = await callAuthenticatedAPI(walletClient, '/api/gacha/mint', {
      cardId,
      wallet: address.toLowerCase(),
      packType: card.packType || null,
      qty: 1,
    })

    if (!data?.success) {
      throw new Error(data?.reason || data?.error || 'Mint failed')
    }

    console.log('✅ Backend mint succeeded!')
    console.log('   Tx hash:', data.txHash)
    console.log('   TokenId:', data.tokenId)

    return data.tokenId
  } catch (e) {
    console.error('Mint failed:', e.message)
    throw e
  }
}

/**
 * Batch mint — ONE signature + ONE backend call
 * Backend will mint sequentially with deployer wallet.
 * @param {string} address
 * @param {Array<{id: string}>} cards
 * @param {import('viem').WalletClient} walletClient
 */
export async function mintCardBatchNFT(address, cards, walletClient) {
  try {
    if (!address) throw new Error('Wallet not connected')
    if (!walletClient) {
      throw new Error('Wallet client required for signed mint. Connect wallet and try again.')
    }

    const cardIds = (cards || [])
      .map((c) => c.id || c.cardId)
      .filter(Boolean)

    if (!cardIds.length) {
      return []
    }

    console.log('Batch minting', cardIds.length, 'cards via single authenticated backend API call')

    const data = await callAuthenticatedAPI(walletClient, '/api/gacha/mint', {
      cardIds,
      wallet: address.toLowerCase(),
      qty: cardIds.length,
    })

    const resultMap = new Map()
    if (Array.isArray(data?.results)) {
      for (const r of data.results) {
        if (r?.success && r.tokenId) resultMap.set(r.tokenId, r.tokenId)
      }
    } else if (data?.success && data.tokenId) {
      resultMap.set(data.tokenId, data.tokenId)
    }

    const tokenIds = cardIds.map(() => null)
    let idx = 0
    for (const [tid] of resultMap) {
      if (idx < tokenIds.length) tokenIds[idx++] = tid
    }

    console.log('✅ Batch mint completed. TokenIds:', tokenIds)
    return tokenIds
  } catch (e) {
    console.error('Batch mint failed:', e.message)
    throw e
  }
}
