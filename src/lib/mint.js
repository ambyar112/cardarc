// NFT Minting — ArcCards ERC-1155 (Backend Mint Flow - SECURE)
// Calls backend API which mints using deployer wallet
// Returns tokenId immediately for collection storage
import { getAccount } from '@wagmi/core'
import { wagmiConfig } from './wagmi'

// Mint 1 kartu via backend API — returns tokenId
export async function mintCardNFT(address, card) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')

    const cardId = card.id

    console.log('Calling backend mint API for:', cardId)

    // Call backend API - backend will mint using deployer wallet
    const response = await fetch('/api/gacha/mint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet: address,
        cardId: cardId,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.reason || 'Mint failed')
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

// Batch mint — mints multiple cards by calling backend API for each
export async function mintCardBatchNFT(address, cards) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')

    console.log('Batch minting', cards.length, 'cards via backend API')

    const tokenIds = []
    
    // Mint each card sequentially via backend
    for (const card of cards) {
      try {
        const tokenId = await mintCardNFT(address, card)
        tokenIds.push(tokenId)
      } catch (e) {
        console.error('Failed to mint card:', card.id, e.message)
        tokenIds.push(null) // Push null for failed mints
      }
    }

    console.log('✅ Batch mint completed. TokenIds:', tokenIds)
    return tokenIds
  } catch (e) {
    console.error('Batch mint failed:', e.message)
    throw e
  }
}

// Note: Balance check function removed
// All minting now goes through backend API for security
