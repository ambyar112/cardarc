// Chain Validation Utility - Ensures all transactions use Arc Network
import { getAccount, switchChain } from '@wagmi/core'
import { wagmiConfig } from './wagmi'

const ARC_TESTNET_CHAIN_ID = 5042002

/**
 * Validates that the wallet is connected to Arc Network
 * @throws {Error} if not on Arc Network
 */
export function validateArcNetwork() {
  const account = getAccount(wagmiConfig)
  
  if (!account.isConnected) {
    throw new Error('Wallet not connected. Please connect your wallet first.')
  }
  
  if (account.chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(
      `Wrong network! You're on ${getNetworkName(account.chainId)}. ` +
      `Please switch to Arc Testnet (Chain ID: ${ARC_TESTNET_CHAIN_ID}).`
    )
  }
  
  return true
}

/**
 * Attempts to switch to Arc Network automatically
 * @returns {Promise<boolean>} true if switched successfully
 */
export async function ensureArcNetwork() {
  const account = getAccount(wagmiConfig)
  
  if (!account.isConnected) {
    throw new Error('Wallet not connected. Please connect your wallet first.')
  }
  
  if (account.chainId === ARC_TESTNET_CHAIN_ID) {
    return true // Already on correct network
  }
  
  // Attempt to switch
  try {
    await switchChain(wagmiConfig, { chainId: ARC_TESTNET_CHAIN_ID })
    return true
  } catch (error) {
    throw new Error(
      `Failed to switch to Arc Testnet. Please manually switch your wallet to Arc Testnet (Chain ID: ${ARC_TESTNET_CHAIN_ID}).`
    )
  }
}

/**
 * Get human-readable network name
 */
function getNetworkName(chainId) {
  const networks = {
    1: 'Ethereum Mainnet',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    84532: 'Base Sepolia Testnet',
    8453: 'Base Mainnet',
    5042002: 'Arc Testnet',
  }
  return networks[chainId] || `Chain ${chainId}`
}

/**
 * Check if currently on Arc Network (non-throwing)
 */
export function isOnArcNetwork() {
  const account = getAccount(wagmiConfig)
  return account.isConnected && account.chainId === ARC_TESTNET_CHAIN_ID
}