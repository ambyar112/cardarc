// NFT Minting — ArcCards ERC-1155 (Direct Mint Flow - Opsi 1)
// Calls mintCard() directly on contract (requires minter role for backend signer)
// Returns tokenId immediately for collection storage
import { writeContract, getPublicClient, getAccount } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { ARC_CARDS_ADDRESS, ARC_CARDS_ABI } from './abi'
import { ensureArcNetwork } from './chainValidator'

const ARC_TESTNET_CHAIN_ID = 5042002

// Mint 1 kartu directly via mintCard() — returns tokenId
export async function mintCardNFT(address, card) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')

    const cardId = card.id

    // writeContract from @wagmi/core handles chain switching atomically
    const hash = await writeContract(wagmiConfig, {
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'mintCard',
      args: [address, cardId],
      chainId: ARC_TESTNET_CHAIN_ID,
    })

    console.log('Mint tx:', hash)

    // Wait for receipt to get tokenId from Transfer event
    const publicClient = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    // Parse TransferSingle event to get tokenId
    let tokenId = null
    for (const log of receipt.logs) {
      try {
        const decoded = publicClient.decodeEventLog({
          abi: ARC_CARDS_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'TransferSingle' || decoded.eventName === 'CardMinted') {
          tokenId = decoded.args?.tokenId ?? decoded.args?.id ?? decoded.args?.[3] ?? null
          break
        }
      } catch {
        // Not our event, skip
      }
    }

    // If no tokenId from event, compute it from cardId mapping
    if (tokenId === null) {
      try {
        tokenId = await publicClient.readContract({
          address: ARC_CARDS_ADDRESS,
          abi: ARC_CARDS_ABI,
          functionName: 'cardToTokenId',
          args: [cardId],
        })
        tokenId = Number(tokenId)
      } catch {
        tokenId = null
      }
    }

    console.log('✅ Minted tokenId:', tokenId, 'for cardId:', cardId)
    return tokenId
  } catch (e) {
    console.error('Mint failed:', e.message)
    throw e
  }
}

// Batch mint — mints all cards in one tx, returns array of tokenIds
export async function mintCardBatchNFT(address, cards) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')

    const cardIds = cards.map(c => c.id)

    const hash = await writeContract(wagmiConfig, {
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'mintCardBatch',
      args: [address, cardIds],
      chainId: ARC_TESTNET_CHAIN_ID,
    })

    console.log('Batch mint tx:', hash)

    // Wait for receipt
    const publicClient = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    // Parse all TransferSingle events to get tokenIds
    const tokenIds = []
    for (const log of receipt.logs) {
      try {
        const decoded = publicClient.decodeEventLog({
          abi: ARC_CARDS_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'TransferSingle' || decoded.eventName === 'CardMinted') {
          const tid = decoded.args?.tokenId ?? decoded.args?.id ?? decoded.args?.[3] ?? null
          if (tid !== null) tokenIds.push(Number(tid))
        }
      } catch {
        // Not our event, skip
      }
    }

    // If events didn't yield enough tokenIds, compute from cardIdToTokenId mapping
    if (tokenIds.length < cards.length) {
      for (const cardId of cardIds) {
        try {
          const tid = await publicClient.readContract({
            address: ARC_CARDS_ADDRESS,
            abi: ARC_CARDS_ABI,
            functionName: 'cardToTokenId',
            args: [cardId],
          })
          tokenIds.push(Number(tid))
        } catch {
          tokenIds.push(null)
        }
      }
    }

    console.log('✅ Batch minted tokenIds:', tokenIds)
    return tokenIds
  } catch (e) {
    console.error('Batch mint failed:', e.message)
    throw e
  }
}

// Cek balance kartu tertentu di blockchain
export async function getCardBalance(address, cardId) {
  try {
    const publicClient = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
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