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
 * Batch mint — sequential authenticated mint calls
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

    console.log('Batch minting', cards.length, 'cards via authenticated backend API')

    const tokenIds = []
    for (const card of cards) {
      try {
        const tokenId = await mintCardNFT(address, card, walletClient)
        tokenIds.push(tokenId)
      } catch (e) {
        console.error('Failed to mint card:', card?.id, e.message)
        tokenIds.push(null)
      }
    }

    console.log('✅ Batch mint completed. TokenIds:', tokenIds)
    return tokenIds
  } catch (e) {
    console.error('Batch mint failed:', e.message)
    throw e
  }
}
