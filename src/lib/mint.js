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

// Note: Batch mint and balance check functions removed
// All minting now goes through backend API for security
// If needed in future, can add backend endpoints for these too
