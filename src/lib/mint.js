// NFT Minting — ArcCards ERC-1155 (Direct Mint Flow - Opsi 1)
// Calls mintCard() directly on contract (requires minter role for backend signer)
// Returns tokenId immediately for collection storage
import { getWalletClient, getPublicClient, switchChain } from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import { ARC_CARDS_ADDRESS, ARC_CARDS_ABI } from './abi'

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

// Mint 1 kartu directly via mintCard() — returns tokenId
export async function mintCardNFT(address, card) {
  try {
    const walletClient = await ensureArcTestnet()

    const cardId = card.id
    const amount = 1

    // Call mintCard directly — user pays gas, contract mints to their address
    const hash = await walletClient.writeContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'mintCard',
      args: [address, cardId, amount],
      chain: { id: ARC_TESTNET_CHAIN_ID },
    })

    console.log('Mint tx:', hash)

    // Wait for receipt to get tokenId from Transfer event
    const publicClient = getPublicClient(wagmiConfig)
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
          functionName: 'cardIdToTokenId',
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
    const walletClient = await ensureArcTestnet()

    const cardIds = cards.map(c => c.id)
    const amounts = cards.map(() => 1)

    const hash = await walletClient.writeContract({
      address: ARC_CARDS_ADDRESS,
      abi: ARC_CARDS_ABI,
      functionName: 'mintCardBatch',
      args: [address, cardIds, amounts],
      chain: { id: ARC_TESTNET_CHAIN_ID },
    })

    console.log('Batch mint tx:', hash)

    // Wait for receipt
    const publicClient = getPublicClient(wagmiConfig)
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
            functionName: 'cardIdToTokenId',
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