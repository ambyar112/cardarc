/**
 * ═══════════════════════════════════════════════════════════════════════
 * RPC FAILOVER ORCHESTRATION SYSTEM
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Multi-endpoint RPC failover with:
 * - Automatic provider rotation on failure
 * - Health check monitoring
 * - Rate limit detection and backoff
 * - Request retries with exponential backoff
 * - Latency tracking and optimal provider selection
 */

import { createPublicClient, http, PublicClient, fallback, Chain } from 'viem';

// ────────────────────────────────────────────────────────────────────────
// ARC TESTNET CHAIN CONFIGURATION
// ────────────────────────────────────────────────────────────────────────

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { 
      name: 'Arc Explorer', 
      url: 'https://explorer.testnet.arc.network' 
    },
  },
  testnet: true,
} as const satisfies Chain;

// ────────────────────────────────────────────────────────────────────────
// RPC ENDPOINT CONFIGURATIONS
// ────────────────────────────────────────────────────────────────────────

interface RpcEndpoint {
  url: string;
  provider: string;
  priority: number;
  maxRetries: number;
}

const RPC_ENDPOINTS: Record<number, RpcEndpoint[]> = {
  // Arc Testnet - Primary and only supported network
  5042002: [
    { url: 'https://rpc.testnet.arc.network', provider: 'Arc Official', priority: 1, maxRetries: 5 },
  ],
};

// ────────────────────────────────────────────────────────────────────────
// HEALTH CHECK & LATENCY TRACKING
// ────────────────────────────────────────────────────────────────────────

interface ProviderHealth {
  url: string;
  isHealthy: boolean;
  lastChecked: number;
  latency: number;
  failureCount: number;
  lastError?: string;
}

class RpcHealthMonitor {
  private health: Map<string, ProviderHealth> = new Map();
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
  private readonly FAILURE_THRESHOLD = 3;
  private readonly LATENCY_THRESHOLD = 5000; // 5 seconds

  async checkHealth(url: string, chainId: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
        signal: AbortSignal.timeout(this.LATENCY_THRESHOLD),
      });

      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      // Update health status
      this.health.set(url, {
        url,
        isHealthy: true,
        lastChecked: Date.now(),
        latency,
        failureCount: 0,
      });

      return true;
    } catch (error) {
      const current = this.health.get(url);
      const failureCount = (current?.failureCount || 0) + 1;
      
      this.health.set(url, {
        url,
        isHealthy: failureCount < this.FAILURE_THRESHOLD,
        lastChecked: Date.now(),
        latency: this.LATENCY_THRESHOLD,
        failureCount,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      });

      return false;
    }
  }

  getHealth(url: string): ProviderHealth | undefined {
    return this.health.get(url);
  }

  getHealthyEndpoints(urls: string[]): string[] {
    return urls
      .map(url => ({ url, health: this.health.get(url) }))
      .filter(({ health }) => !health || health.isHealthy)
      .sort((a, b) => (a.health?.latency || Infinity) - (b.health?.latency || Infinity))
      .map(({ url }) => url);
  }
}

// ────────────────────────────────────────────────────────────────────────
// GLOBAL HEALTH MONITOR INSTANCE
// ────────────────────────────────────────────────────────────────────────

const healthMonitor = new RpcHealthMonitor();

// ────────────────────────────────────────────────────────────────────────
// PUBLIC CLIENT FACTORY WITH FAILOVER
// ────────────────────────────────────────────────────────────────────────

const CHAIN_MAP: Record<number, Chain> = {
  5042002: arcTestnet,
};

export function createResilientPublicClient(chainId: number): PublicClient {
  const chain = CHAIN_MAP[chainId];
  
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const endpoints = RPC_ENDPOINTS[chainId] || [];
  
  if (endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for chain ${chainId}`);
  }

  // Sort by priority
  const sortedEndpoints = [...endpoints].sort((a, b) => a.priority - b.priority);
  
  // Create transports with retry logic
  const transports = sortedEndpoints.map(endpoint => 
    http(endpoint.url, {
      timeout: 30000, // 30 second timeout
      retryCount: endpoint.maxRetries,
      retryDelay: 1000, // 1 second base delay
    })
  );

  // Create client with fallback transport
  return createPublicClient({
    chain,
    transport: fallback(transports, {
      rank: true, // Enable automatic ranking based on latency
    }),
    batch: {
      multicall: true, // Enable multicall batching
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// CLIENT CACHE
// ────────────────────────────────────────────────────────────────────────

const clientCache = new Map<number, PublicClient>();

export function getPublicClient(chainId: number): PublicClient {
  let client = clientCache.get(chainId);
  
  if (!client) {
    client = createResilientPublicClient(chainId);
    clientCache.set(chainId, client);
  }
  
  return client;
}

// ────────────────────────────────────────────────────────────────────────
// HEALTH CHECK API
// ────────────────────────────────────────────────────────────────────────

export async function checkRpcHealth(chainId: number): Promise<ProviderHealth[]> {
  const endpoints = RPC_ENDPOINTS[chainId] || [];
  
  const checks = await Promise.all(
    endpoints.map(async endpoint => {
      await healthMonitor.checkHealth(endpoint.url, chainId);
      return healthMonitor.getHealth(endpoint.url)!;
    })
  );

  return checks;
}

export function getRpcHealthStatus(chainId: number): ProviderHealth[] {
  const endpoints = RPC_ENDPOINTS[chainId] || [];
  return endpoints
    .map(e => healthMonitor.getHealth(e.url))
    .filter((h): h is ProviderHealth => h !== undefined);
}

// ────────────────────────────────────────────────────────────────────────
// RETRY UTILITY WITH EXPONENTIAL BACKOFF
// ────────────────────────────────────────────────────────────────────────

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if we shouldn't or if this was the last attempt
      if (!shouldRetry(lastError) || attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
      const delay = exponentialDelay + jitter;

      console.warn(`[RPC Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`, lastError.message);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached due to the loop logic, but TypeScript needs it
  throw new Error('Retry limit exceeded');
}

// ────────────────────────────────────────────────────────────────────────
// ERROR CLASSIFICATION
// ────────────────────────────────────────────────────────────────────────

export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Rate limiting errors
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return true;
  }
  
  // Network errors
  if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
    return true;
  }
  
  // Server errors
  if (message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }
  
  // Nonce errors (can happen during high traffic)
  if (message.includes('nonce')) {
    return true;
  }
  
  return false;
}