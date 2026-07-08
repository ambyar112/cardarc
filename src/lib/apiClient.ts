/**
 * API Client with EIP-191 Signature Authentication
 * 
 * Handles cryptographic signing of API requests to prevent:
 * - Wallet impersonation
 * - Replay attacks
 * - Unauthorized access
 * 
 * @module apiClient
 */

import { createWalletClient, custom, type WalletClient } from 'viem';
import { arcTestnet } from './wagmi';

/**
 * Generate EIP-191 personal signature for message
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
 * Backend expects:
 * - X-Wallet-Address header
 * - X-Signature header  
 * - X-Timestamp header
 * - Request body (will be verified against signature)
 * 
 * @param walletClient - Viem wallet client
 * @param endpoint - API endpoint path (e.g., '/api/gacha/claim')
 * @param body - Request body object
 * @returns Signed request headers and body
 */
async function createAuthenticatedRequest(
  walletClient: WalletClient,
  endpoint: string,
  body: Record<string, any>
): Promise<{
  headers: Record<string, string>;
  body: Record<string, any>;
}> {
  if (!walletClient.account) {
    throw new Error('Wallet not connected');
  }

  const walletAddress = walletClient.account.address;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Create deterministic message to sign
  // Format: endpoint|timestamp|JSON(body)
  const bodyJson = JSON.stringify(body);
  const messageToSign = `${endpoint}|${timestamp}|${bodyJson}`;

  console.log('[apiClient] Signing request:', {
    endpoint,
    walletAddress,
    timestamp,
    bodyLength: bodyJson.length
  });

  // Generate signature
  const signature = await signMessage(walletClient, messageToSign);

  return {
    headers: {
      'Content-Type': 'application/json',
      'X-Wallet-Address': walletAddress,
      'X-Signature': signature,
      'X-Timestamp': timestamp,
    },
    body,
  };
}

/**
 * Call authenticated API endpoint
 * 
 * @param walletClient - Viem wallet client (from useWalletClient)
 * @param endpoint - API endpoint path
 * @param body - Request body
 * @returns API response data
 */
export async function callAuthenticatedAPI<T = any>(
  walletClient: WalletClient | undefined,
  endpoint: string,
  body: Record<string, any>
): Promise<T> {
  if (!walletClient) {
    throw new Error('Wallet client not initialized. Please connect your wallet.');
  }

  if (!walletClient.account) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }

  try {
    // Create signed request
    const { headers, body: requestBody } = await createAuthenticatedRequest(
      walletClient,
      endpoint,
      body
    );

    console.log('[apiClient] Calling authenticated endpoint:', endpoint);

    // Make API call
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        throw new Error('Authentication failed: ' + (data.error || 'Invalid signature'));
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded: ' + (data.error || 'Too many requests'));
      }
      throw new Error(data.error || `API error: ${response.status}`);
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
    if (error.message.includes('User rejected')) {
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
   * Claim gacha pack
   */
  async claimGacha(
    walletClient: WalletClient | undefined,
    packType: string
  ): Promise<{ success: boolean; cards: any[] }> {
    return callAuthenticatedAPI(walletClient, '/api/gacha/claim', { packType });
  },

  /**
   * Mint NFT cards
   */
  async mintCards(
    walletClient: WalletClient | undefined,
    cards: any[]
  ): Promise<{ success: boolean; txHash: string; tokenIds: number[] }> {
    return callAuthenticatedAPI(walletClient, '/api/gacha/mint', { cards });
  },

  /**
   * Add cards to collection
   */
  async addToCollection(
    walletClient: WalletClient | undefined,
    cards: any[]
  ): Promise<{ success: boolean }> {
    return callAuthenticatedAPI(walletClient, '/api/collection/add', { cards });
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