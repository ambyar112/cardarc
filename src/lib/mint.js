// NFT Minting — ArcCards ERC-1155 (Claim Flow)
// Backend authorizes via /api/gacha/claim → returns signature → contract.claimMint()
import { getWalletClient, getPublicClient } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { ARC_CARDS_ADDRESS, ARC_CARDS_ABI } from './abi'

const CLAIM_API_URL = import.meta.env.VITE_CLAIM_API_URL || '/api/gacha/claim'

// Generate random 32-byte hex nonce
function generateNonce() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Request signature from backend after gacha pull
async function requestClaimSignature(wallet, cardId, nonce) {
  const response = await fetch(CLAIM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, cardId, nonce }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.reason || `Claim API error: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success || !data.signature) {
    throw new Error(data.reason || 'No signature returned')
  }

  return data.signature
}

// Mint 1 kartu via claimMint (backend-authorized)
export async function mintCardNFT(address, card) {
  try {
    const walletClient = await getWalletClient(wagmiConfig)
    if (!walletClient) throw new Error('No wallet client')

    const cardId = card.id
    const nonce = generateNonce()

    // Get signature from backend (verifies gacha pull, prevents double-claim)
    const signature = await requestClaimSignature(address, cardId, nonce)

    // Call claimMint on contract (user signs, contract validates sig)
    const hash = await walletClient.writeContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'claimMint',
      args: [address, cardId, nonce, signature],
    })

    console.log('Claim mint tx:', hash)
    return { success: true, hash }
  } catch (e) {
    console.error('Claim mint failed:', e.message)
    return { success: false, error: e.message }
  }
}

// Batch claim mint
export async function mintCardBatchNFT(address, cards) {
  try {
    const walletClient = await getWalletClient(wagmiConfig)
    if (!walletClient) throw new Error('No wallet client')

    const signatures = []
    const nonces = []
    const cardIds = []

    // Request signature for each card sequentially
    for (const card of cards) {
      const nonce = generateNonce()
      const sig = await requestClaimSignature(address, card.id, nonce)
      signatures.push(sig)
      nonces.push(nonce)
      cardIds.push(card.id)
    }

    const hash = await walletClient.writeContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'claimMintBatch',
      args: [address, cardIds, nonces, signatures],
    })

    console.log('Batch claim mint tx:', hash)
    return { success: true, hash }
  } catch (e) {
    console.error('Batch claim mint failed:', e.message)
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