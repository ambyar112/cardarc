// ArcMarketplace on-chain interactions
// SECURITY: selfMintCard removed — contract no longer has selfMint function.
//           Cards must be minted via mintCard (onlyMinter) before listing.
import { getWalletClient, getPublicClient, switchChain } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { ARC_CARDS_ADDRESS, ARC_CARDS_ABI, ARC_MARKETPLACE_ADDRESS, ARC_MARKETPLACE_ABI } from './abi'
import { parseEther, formatEther } from 'viem'

const ARC_TESTNET_CHAIN_ID = 5042002

// Ensure wallet is on Arc Testnet — FORCE switch via direct MetaMask RPC
async function ensureArcTestnet() {
  if (!window.ethereum) throw new Error('No wallet detected')
  
  const chainIdHex = `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`
  
  // Get current chain from MetaMask directly
  let currentChain
  try {
    currentChain = await window.ethereum.request({ method: 'eth_chainId' })
  } catch {
    throw new Error('Failed to get current chain from wallet')
  }
  
  if (currentChain !== chainIdHex) {
    console.log(`⚠️ Wallet on chain ${currentChain}, forcing switch to Arc Testnet (${chainIdHex})...`)
    
    // Try switch first
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      console.log('✅ Switched to Arc Testnet')
    } catch (switchError) {
      // If chain doesn't exist (error 4902), add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: 'Arc Testnet',
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
              rpcUrls: ['https://rpc.testnet.arc.network'],
              blockExplorerUrls: ['https://testnet.arcscan.app'],
            }],
          })
          console.log('✅ Arc Testnet added and switched')
        } catch (addError) {
          throw new Error('Failed to add Arc Testnet. Please add manually: Chain ID 5042002')
        }
      } else {
        throw new Error(`Chain switch rejected: ${switchError.message}`)
      }
    }
    
    // Verify switch succeeded
    const newChain = await window.ethereum.request({ method: 'eth_chainId' })
    if (newChain !== chainIdHex) {
      throw new Error(`Switch failed. Still on chain ${newChain}. Please manually switch MetaMask to Arc Testnet.`)
    }
  }
  
  // Now get Wagmi wallet client (should be on correct chain)
  const walletClient = await getWalletClient(wagmiConfig)
  if (!walletClient) throw new Error('No wallet client after switch')
  
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
      chain: { id: ARC_TESTNET_CHAIN_ID },
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
      chain: { id: ARC_TESTNET_CHAIN_ID },
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
      chain: { id: ARC_TESTNET_CHAIN_ID },
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
      chain: { id: ARC_TESTNET_CHAIN_ID },
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
      chain: { id: ARC_TESTNET_CHAIN_ID },
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
