/**
 * API Client with Wallet Signature Authentication
 * 
 * Handles cryptographic signing of API requests to prevent:
 * - Wallet impersonation
 * - Replay attacks
 * - Unauthorized access
 * 
 * @module apiClient
 */

import { type WalletClient } from 'viem';

/**
 * Generate wallet signature for authentication
 * 
 * @param walletClient - Viem wallet client (from useWalletClient hook)
 * @param message - Message to sign
 * @returns Signature hex string (0x...)
 */
async function signMessage(
  walletClient: WalletClient,
  message: string
): Promise<string> {
  if (!walletClient.account) {
    throw new Error('Wallet not connected');
  }

  try {
    const signature = await walletClient.signMessage({
      account: walletClient.account,
      message,
    });
    
    return signature;
  } catch (error) {
    console.error('[apiClient] Signature generation failed:', error);
    throw new Error('Failed to sign message. Please try again.');
  }
}

/**
 * Create authenticated request payload with signature
 * 
 * Backend expects IN BODY (NOT headers):
 * - wallet: wallet address
 * - signature: EIP-191 signature
 * - message: signed message (format: "Arc Cards Authentication\nWallet: {wallet}\nTimestamp: {timestamp}")
 * - timestamp: unix timestamp in milliseconds
 * - ...other request fields (cardId, packType, etc.)
 * 
 * @param walletClient - Viem wallet client
 * @param body - Request body object (will be augmented with auth fields)
 * @returns Body with authentication fields added
 */
async function createAuthenticatedRequest(
  walletClient: WalletClient,
  body: Record<string, any>
): Promise<Record<string, any>> {
  if (!walletClient.account) {
    throw new Error('Wallet not connected');
  }

  const wallet = walletClient.account.address.toLowerCase();
  const timestamp = Date.now(); // milliseconds, not seconds!

  // Create message matching backend expectations
  // MUST match format in api/_middleware/auth.ts line 41
  const message = `Arc Cards Authentication\nWallet: ${wallet}\nTimestamp: ${timestamp}`;

  console.log('[apiClient] Creating authentication:', {
    wallet,
    timestamp,
    messageLength: message.length
  });

  // Generate signature
  const signature = await signMessage(walletClient, message);

  // Return body with auth fields added
  return {
    ...body,
    wallet,
    signature,
    message,
    timestamp,
  };
}

/**
 * Call authenticated API endpoint
 * 
 * @param walletClient - Viem wallet client (from useWalletClient)
 * @param endpoint - API endpoint path
 * @param body - Request body (auth fields will be added automatically)
 * @returns API response data
 */
export async function callAuthenticatedAPI<T = any>(
  walletClient: WalletClient | undefined,
  endpoint: string,
  body: Record<string, any> = {}
): Promise<T> {
  if (!walletClient) {
    throw new Error('Wallet client not initialized. Please connect your wallet.');
  }

  if (!walletClient.account) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }

  try {
    // Create signed request (auth fields added to body)
    const authenticatedBody = await createAuthenticatedRequest(
      walletClient,
      body
    );

    console.log('[apiClient] Calling authenticated endpoint:', endpoint);

    // Make API call
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authenticatedBody),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        throw new Error('Authentication failed: ' + (data.error || data.reason || 'Invalid signature'));
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded: ' + (data.error || data.reason || 'Too many requests'));
      }
      throw new Error(data.error || data.reason || `API error: ${response.status}`);
    }

    console.log('[apiClient] Request successful:', endpoint);
    return data;

  } catch (error: any) {
    console.error('[apiClient] API call failed:', {
      endpoint,
      error: error.message,
      stack: error.stack
    });
    
    // Re-throw with user-friendly message
    if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
      throw new Error('Signature rejected. Please approve the signature request.');
    }
    
    throw error;
  }
}

/**
 * Specialized API call wrappers for common endpoints
 */

export const api = {
  /**
   * Claim gacha voucher (legacy path — prefer mintCard for on-chain mint)
   */
  async claimGacha(
    walletClient: WalletClient | undefined,
    packType: string
  ): Promise<{ success: boolean; cards: any[] }> {
    return callAuthenticatedAPI(walletClient, '/api/gacha/claim', { packType });
  },

  /**
   * Mint a single NFT via backend deployer (authenticated)
   */
  async mintCard(
    walletClient: WalletClient | undefined,
    cardId: string
  ): Promise<{ success: boolean; txHash?: string; tokenId?: number; reason?: string }> {
    return callAuthenticatedAPI(walletClient, '/api/gacha/mint', { cardId });
  },

  /**
   * Mint NFT cards (sequential single-card mints)
   */
  async mintCards(
    walletClient: WalletClient | undefined,
    cards: any[]
  ): Promise<{ success: boolean; tokenIds: (number | null)[] }> {
    const tokenIds: (number | null)[] = [];
    for (const c of cards || []) {
      try {
        const r = await callAuthenticatedAPI<{ success: boolean; tokenId?: number }>(
          walletClient,
          '/api/gacha/mint',
          { cardId: c.id || c.cardId }
        );
        tokenIds.push(r?.tokenId ?? null);
      } catch {
        tokenIds.push(null);
      }
    }
    return { success: tokenIds.some((t) => t != null), tokenIds };
  },

  /**
   * Add cards to collection (supports single card or cards[])
   * Backend accepts { card } or { cards: [...] }
   */
  async addToCollection(
    walletClient: WalletClient | undefined,
    cards: any[]
  ): Promise<{ success: boolean }> {
    const list = Array.isArray(cards) ? cards : [cards];
    // Normalize payload for backend
    const normalized = list.map((c) => ({
      id: c.id,
      name: c.name || c.id || 'Unknown',
      tier: c.tier || c.rarity || 'common',
      img: c.img,
      setId: c.setId,
      localId: c.localId,
      hp: c.hp,
      types: c.types,
      rarity: c.rarity,
      atk: c.atk,
      def: c.def,
      level: c.level,
      nftTokenId: c.nftTokenId ?? c.nft_token_id ?? null,
    }));
    return callAuthenticatedAPI(walletClient, '/api/collection/add', { cards: normalized });
  },
};

/**
 * Type definitions
 */
export interface AuthenticatedAPIOptions {
  walletClient: WalletClient;
  endpoint: string;
  body: Record<string, any>;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Error types for better error handling
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class SignatureRejectedError extends Error {
  constructor() {
    super('User rejected signature request');
    this.name = 'SignatureRejectedError';
  }
}