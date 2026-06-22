// ArcMarketplace on-chain interactions
// SECURITY: selfMintCard removed — contract no longer has selfMint function.
//           Cards must be minted via mintCard (onlyMinter) before listing.
import { getWalletClient, getPublicClient, switchChain } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { ARC_CARDS_ADDRESS, ARC_CARDS_ABI, ARC_MARKETPLACE_ADDRESS, ARC_MARKETPLACE_ABI } from './abi'
import { parseEther, formatEther } from 'viem'

const ARC_TESTNET_CHAIN_ID = 5042002

// Ensure wallet is on Arc Testnet — blocks tx if switch fails
async function ensureArcTestnet() {
  let walletClient = await getWalletClient(wagmiConfig)
  if (!walletClient) throw new Error('No wallet client')

  if (walletClient.chain.id !== ARC_TESTNET_CHAIN_ID) {
    console.log(`⚠️ Wallet on chain ${walletClient.chain.id}, switching to Arc Testnet (${ARC_TESTNET_CHAIN_ID})...`)
    await switchChain(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    // Re-get wallet client after switch — old reference has stale chain
    walletClient = await getWalletClient(wagmiConfig)
    if (walletClient.chain.id !== ARC_TESTNET_CHAIN_ID) {
      throw new Error(`Chain switch failed. Still on chain ${walletClient.chain.id}. Please manually switch MetaMask to Arc Testnet (${ARC_TESTNET_CHAIN_ID}).`)
    }
    console.log('✅ Switched to Arc Testnet')
  }
  return walletClient
}

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
    const wc = await ensureArcTestnet()
    const hash = await wc.writeContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'setApprovalForAll',
      args: [ARC_MARKETPLACE_ADDRESS, true],
    })
    const pub = getPublicClient(wagmiConfig)
    await pub.waitForTransactionReceipt({ hash })
    return { success: true, hash }
  } catch (e) {
    console.error('approveMarketplace:', e.message)
    return { success: false, error: e.shortMessage || e.message }
  }
}

// ─── WRITE: list a card ──────────────────────────────────────
// NOTE: tokenId must already exist on-chain (card must have been minted).
//       The contract now verifies cardId matches tokenIdToCard[tokenId].

export async function listCard(tokenId, cardId, priceEth) {
  try {
    const wc = await ensureArcTestnet()

    // Validate inputs before sending tx
    const priceNum = parseFloat(priceEth)
    if (!priceNum || priceNum <= 0) throw new Error('Invalid price')
    if (!tokenId || tokenId <= 0)   throw new Error('Invalid token ID — card must be minted first')

    const priceWei = parseEther(String(priceEth))
    const hash = await wc.writeContract({
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'listCard',
      args: [BigInt(tokenId), cardId, priceWei],
    })
    const pub = getPublicClient(wagmiConfig)
    const receipt = await pub.waitForTransactionReceipt({ hash })

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
    console.error('listCard:', e.message)
    return { success: false, error: e.shortMessage || e.message }
  }
}

// ─── WRITE: purchase a listing ───────────────────────────────

export async function purchaseListing(listingId, priceWei) {
  try {
    const wc = await ensureArcTestnet()
    const hash = await wc.writeContract({
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'purchase',
      args: [BigInt(listingId)],
      value: BigInt(String(priceWei)),
    })
    const pub = getPublicClient(wagmiConfig)
    await pub.waitForTransactionReceipt({ hash })
    return { success: true, hash }
  } catch (e) {
    console.error('purchaseListing:', e.message)
    return { success: false, error: e.shortMessage || e.message }
  }
}

// ─── WRITE: cancel a listing ────────────────────────────────

export async function cancelListing(listingId) {
  try {
    const wc = await ensureArcTestnet()
    const hash = await wc.writeContract({
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'cancelListing',
      args: [BigInt(listingId)],
    })
    const pub = getPublicClient(wagmiConfig)
    await pub.waitForTransactionReceipt({ hash })
    return { success: true, hash }
  } catch (e) {
    console.error('cancelListing:', e.message)
    return { success: false, error: e.shortMessage || e.message }
  }
}

// ─── WRITE: update price ─────────────────────────────────────

export async function updateListingPrice(listingId, newPriceEth) {
  try {
    const wc = await ensureArcTestnet()
    const hash = await wc.writeContract({
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'updatePrice',
      args: [BigInt(listingId), parseEther(String(newPriceEth))],
    })
    const pub = getPublicClient(wagmiConfig)
    await pub.waitForTransactionReceipt({ hash })
    return { success: true, hash }
  } catch (e) {
    return { success: false, error: e.shortMessage || e.message }
  }
}

// ─── READ: fetch active on-chain listings ────────────────────

export async function fetchOnChainListings(count = 50) {
  try {
    const pub = getPublicClient(wagmiConfig)
    // getActiveListings returns (Listing[] result, uint256 total) — destructure correctly
    const [result] = await pub.readContract({
      address: ARC_MARKETPLACE_ADDRESS,
      abi: ARC_MARKETPLACE_ABI,
      functionName: 'getActiveListings',
      args: [1n, BigInt(count)],
    })
    if (!Array.isArray(result)) return []
    return result.map(l => ({
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
