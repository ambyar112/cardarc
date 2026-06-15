// NFT Minting — ArcCards ERC-1155
// Mint dipanggil saat user pull gacha dan wallet terconnect
import { getWalletClient, getPublicClient } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { ARC_CARDS_ADDRESS, ARC_CARDS_ABI } from './abi'

// Mint 1 kartu ke wallet user
export async function mintCardNFT(address, card) {
  try {
    const walletClient = await getWalletClient(wagmiConfig)
    if (!walletClient) throw new Error('No wallet client')

    const cardId = card.id // contoh: "swsh8-1", "ygo-12345", "dbs-FB01-003"

    const hash = await walletClient.writeContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'mintCard',
      args: [address, cardId],
    })

    console.log('Mint tx:', hash)
    return { success: true, hash }
  } catch (e) {
    // Jangan block user experience kalau mint gagal
    console.error('Mint failed:', e.message)
    return { success: false, error: e.message }
  }
}

// Batch mint 10 kartu sekaligus (lebih hemat gas)
export async function mintCardBatchNFT(address, cards) {
  try {
    const walletClient = await getWalletClient(wagmiConfig)
    if (!walletClient) throw new Error('No wallet client')

    const cardIds = cards.map(c => c.id)

    const hash = await walletClient.writeContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'mintCardBatch',
      args: [address, cardIds],
    })

    console.log('Batch mint tx:', hash)
    return { success: true, hash }
  } catch (e) {
    console.error('Batch mint failed:', e.message)
    return { success: false, error: e.message }
  }
}

// Cek balance kartu tertentu di blockchain
export async function getCardBalance(address, cardId) {
  try {
    const publicClient = getPublicClient(wagmiConfig)
    const balance = await publicClient.readContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'cardBalance',
      args: [address, cardId],
    })
    return Number(balance)
  } catch (e) {
    console.error('Balance check failed:', e.message)
    return 0
  }
}
