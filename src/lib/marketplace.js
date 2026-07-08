// ArcMarketplace on-chain interactions
// SECURITY: selfMintCard removed — contract no longer has selfMint function.
//           Cards must be minted via mintCard (onlyMinter) before listing.
import { writeContract, getPublicClient, getAccount } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { ARC_CARDS_ADDRESS, ARC_CARDS_ABI, ARC_MARKETPLACE_ADDRESS, ARC_MARKETPLACE_ABI } from './abi'
import { parseEther, formatEther } from 'viem'
import { extractTransactionError } from './errorExtractor'

const ARC_TESTNET_CHAIN_ID = 5042002

// ─── HELPERS ────────────────────────────────────────────────

export function weiToDisplay(wei) {
  const eth = parseFloat(formatEther(BigInt(String(wei))))
  return eth === 0 ? '0' : eth < 0.001 ? '<0.001' : eth.toFixed(4)
}

/** Normalize wallet address to lowercase checksum-safe string */
function normalizeAddress(addr) {
  return typeof addr === 'string' ? addr.toLowerCase() : ''
}

// ─── READ: get on-chain tokenId for a cardId ────────────────

export async function getTokenId(cardId) {
  try {
    const pub = getPublicClient(wagmiConfig)
    const tokenId = await pub.readContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'cardToTokenId',
      args: [cardId],
    })
    return Number(tokenId)
  } catch {
    return 0
  }
}

// ─── READ: check NFT balance (ownership verification) ────────

export async function checkNFTBalance(walletAddress, tokenId) {
  try {
    const pub = getPublicClient(wagmiConfig)
    const balance = await pub.readContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'balanceOf',
      args: [walletAddress, BigInt(tokenId)],
    })
    return Number(balance)
  } catch {
    return 0
  }
}

// ─── READ: check if marketplace is approved ─────────────────

export async function isMarketplaceApproved(walletAddress) {
  try {
    const pub = getPublicClient(wagmiConfig)
    return await pub.readContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'isApprovedForAll',
      args: [walletAddress, ARC_MARKETPLACE_ADDRESS],
    })
  } catch {
    return false
  }
}

// ─── WRITE: approve marketplace to transfer cards ───────────

export async function approveMarketplace() {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')
    
    const hash = await writeContract(wagmiConfig, {
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'setApprovalForAll',
      args: [ARC_MARKETPLACE_ADDRESS, true],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
    const pub = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })
    return { success: true, hash }
  } catch (e) {
    console.error('approveMarketplace:', e)
    return { success: false, error: extractTransactionError(e) }
  }
}

// ─── WRITE: list a card ──────────────────────────────────────
// NOTE: tokenId must already exist on-chain (card must have been minted).
//       Contract requires cardId for on-chain verification (SC-02 fix).

export async function listCard(tokenId, cardId, priceEth) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')

    // Validate inputs before sending tx
    const priceNum = parseFloat(priceEth)
    if (!priceNum || priceNum <= 0) throw new Error('Invalid price')
    if (!tokenId || tokenId <= 0)   throw new Error('Invalid token ID — card must be minted first')
    if (!cardId || cardId.trim() === '') throw new Error('Invalid card ID')

    const priceWei = parseEther(String(priceEth))
    const hash = await writeContract(wagmiConfig, {
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'listCard',
      args: [BigInt(tokenId), cardId, priceWei],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
    const pub = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })

    // Check if transaction actually succeeded on-chain
    if (receipt.status === 'reverted' || receipt.status === 0) {
      // Try to get more specific error info by simulating the call
      try {
        await pub.simulateContract({
          address: ARC_MARKETPLACE_ADDRESS,
          abi: ARC_MARKETPLACE_ABI,
          functionName: 'listCard',
          args: [BigInt(tokenId), cardId, priceWei],
          account: account.address,
        })
      } catch (simError) {
        // If simulation also fails, we get the actual revert reason
        throw simError
      }
      // If simulation succeeds but tx reverted, throw generic error
      throw new Error('Transaction reverted on-chain. Kemungkinan card sudah di-list atau tidak ada ownership.')
    }

    // Parse the Listed event to get the real on-chain listingId
    let listingId = null
    try {
      const listedLog = receipt.logs.find(log =>
        log.address.toLowerCase() === ARC_MARKETPLACE_ADDRESS.toLowerCase() &&
        log.topics.length >= 2
      )
      if (listedLog) listingId = Number(BigInt(listedLog.topics[1]))
    } catch {}

    return { success: true, hash, listingId }
  } catch (e) {
    console.error('listCard:', e)
    return { success: false, error: extractTransactionError(e) }
  }
}

// ─── WRITE: purchase a listing ───────────────────────────────

export async function purchaseListing(listingId, priceWei) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')
    
    const hash = await writeContract(wagmiConfig, {
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'purchase',
      args: [BigInt(listingId)],
      value: BigInt(String(priceWei)),
      chainId: ARC_TESTNET_CHAIN_ID,
    })
    const pub = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })
    return { success: true, hash }
  } catch (e) {
    console.error('purchaseListing:', e)
    return { success: false, error: extractTransactionError(e) }
  }
}

// ─── WRITE: cancel a listing ────────────────────────────────

export async function cancelListing(listingId) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')
    
    const hash = await writeContract(wagmiConfig, {
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'cancelListing',
      args: [BigInt(listingId)],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
    const pub = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })
    return { success: true, hash }
  } catch (e) {
    console.error('cancelListing:', e)
    return { success: false, error: extractTransactionError(e) }
  }
}

// ─── WRITE: update price ─────────────────────────────────────

export async function updateListingPrice(listingId, newPriceEth) {
  try {
    const account = getAccount(wagmiConfig)
    if (!account.address) throw new Error('Wallet not connected')
    
    const hash = await writeContract(wagmiConfig, {
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'updatePrice',
      args: [BigInt(listingId), parseEther(String(newPriceEth))],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
    const pub = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })
    return { success: true, hash }
  } catch (e) {
    return { success: false, error: e.shortMessage || e.message }
  }
}

// ─── READ: fetch active on-chain listings ────────────────────
// NOTE: Contract doesn't have getActiveListings() - we loop through individual getListing() calls

export async function fetchOnChainListings(maxCount = 50) {
  try {
    const pub = getPublicClient(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    
    // Get the next listing ID to know how many listings exist
    const nextId = await pub.readContract({
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'nextListingId',
    })
    
    const totalListings = Number(nextId) - 1 // nextListingId is always 1 ahead
    if (totalListings <= 0) return [] // No listings yet
    
    // Determine how many to fetch (cap at maxCount)
    const fetchCount = Math.min(totalListings, maxCount)
    
    // Fetch listings in parallel (more efficient than sequential)
    const promises = []
    for (let id = 1; id <= fetchCount; id++) {
      promises.push(
        pub.readContract({
          address: ARC_MARKETPLACE_ADDRESS,
          abi: ARC_MARKETPLACE_ABI,
          functionName: 'getListing',
          args: [BigInt(id)],
        }).catch(() => null) // Return null for failed fetches
      )
    }
    
    const results = await Promise.all(promises)
    
    // Filter out failed fetches and inactive listings
    return results
      .filter(l => l !== null && l.active === true)
      .map(l => ({
        listingId: Number(l.listingId),
        seller:    normalizeAddress(l.seller),
        tokenId:   Number(l.tokenId),
        cardId:    l.cardId,
        price:     l.price.toString(),
        priceEth:  formatEther(l.price),
        active:    l.active,
      }))
  } catch (e) {
    console.error('fetchOnChainListings:', e.message)
    return []
  }
}

export { formatEther, parseEther }
