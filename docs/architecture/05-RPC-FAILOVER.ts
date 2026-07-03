/**
 * ═══════════════════════════════════════════════════════════════════════
 * RPC FAILOVER NETWORK — Multi-Provider Resilience
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURE:
 * - Viem fallback() transport with latency-based ranking
 * - 30s timeout per endpoint, automatic failover on error
 * - Health monitoring with periodic latency probes
 * - Error classification: rate-limit, network, server → all retryable
 *
 * PROVIDERS:
 * 1. Primary: rpc.testnet.arc.network (dedicated, lowest latency)
 * 2. Secondary: Ankr public RPC (global CDN, high availability)
 * 3. Tertiary: thirdweb RPC (free tier, backup)
 *
 * WHY THIS MATTERS:
 * Single RPC endpoint = single point of failure. If the primary node
 * goes down or rate-limits, the entire dApp becomes unusable. This
 * module ensures zero-downtime by transparently failing over.
 *
 * INTEGRATION:
 * This module is already integrated into src/lib/wagmi.js and
 * src/lib/rpcProvider.ts. Below is the standalone reference impl.
 */

import { createPublicClient, fallback, http, type PublicClient, type Chain } from 'viem';

// ────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────

interface RpcEndpoint {
  name: string;
  url: string;
  timeout: number;
  priority: number; // lower = higher priority
  healthScore: number; // 0-100, auto-adjusted by health checks
  lastLatencyMs: number;
  lastCheckAt: number;
  consecutiveFailures: number;
}

interface FailoverConfig {
  endpoints: Omit<RpcEndpoint, 'healthScore' | 'lastLatencyMs' | 'lastCheckAt' | 'consecutiveFailures'>[];
  healthCheckIntervalMs: number;
  maxConsecutiveFailures: number;
  latencyWeight: number; // 0-1, how much latency affects ranking
  failurePenalty: number; // health score penalty per failure
  recoveryBonus: number; // health score bonus per successful check
}

// ────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FailoverConfig = {
  endpoints: [
    {
      name: 'Arc Primary',
      url: 'https://rpc.testnet.arc.network',
      timeout: 15_000,
      priority: 1,
    },
    {
      name: 'Ankr Backup',
      url: 'https://rpc.ankr.com/arc_testnet',
      timeout: 20_000,
      priority: 2,
    },
    {
      name: 'Thirdweb Fallback',
      url: 'https://333.rpc.thirdweb.com',
      timeout: 25_000,
      priority: 3,
    },
  ],
  healthCheckIntervalMs: 30_000,
  maxConsecutiveFailures: 5,
  latencyWeight: 0.3,
  failurePenalty: 15,
  recoveryBonus: 10,
};

// ────────────────────────────────────────────────────────────────────────
// RPC FAILOVER MANAGER
// ────────────────────────────────────────────────────────────────────────

class RpcFailoverManager {
  private endpoints: RpcEndpoint[];
  private config: FailoverConfig;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private activeEndpointIndex: number = 0;

  constructor(config: Partial<FailoverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.endpoints = this.config.endpoints.map(ep => ({
      ...ep,
      healthScore: 100,
      lastLatencyMs: 0,
      lastCheckAt: 0,
      consecutiveFailures: 0,
    }));
  }

  /**
   * Create a Viem PublicClient with fallback transport.
   * Viem's fallback() handles automatic failover between transports.
   */
  createClient(chain: Chain): PublicClient {
    const transports = this.endpoints.map(ep =>
      http(ep.url, {
        timeout: ep.timeout,
        retryCount: 3,
        retryDelay: 1000,
      })
    );

    return createPublicClient({
      chain,
      transport: fallback(transports, {
        rank: true, // Auto-rank by latency
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
  }

  /**
   * Health check: probe each endpoint with eth_blockNumber.
   * Updates latency and health scores. Called periodically.
   */
  async runHealthCheck(): Promise<void> {
    const now = Date.now();

    const checks = this.endpoints.map(async (ep, index) => {
      const start = performance.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const latency = performance.now() - start;
        ep.lastLatencyMs = latency;
        ep.lastCheckAt = now;
        ep.consecutiveFailures = 0;

        // Recovery bonus
        ep.healthScore = Math.min(100, ep.healthScore + this.config.recoveryBonus);
      } catch {
        ep.consecutiveFailures++;
        ep.lastCheckAt = now;

        // Failure penalty (exponential for consecutive failures)
        const penalty = this.config.failurePenalty * Math.pow(1.5, ep.consecutiveFailures - 1);
        ep.healthScore = Math.max(0, ep.healthScore - penalty);
      }
    });

    await Promise.allSettled(checks);

    // Re-sort by composite score: priority + health + latency
    this.endpoints.sort((a, b) => {
      const scoreA = this._compositeScore(a);
      const scoreB = this._compositeScore(b);
      return scoreB - scoreA; // Higher score = better
    });
  }

  /**
   * Composite score for endpoint ranking.
   * Combines base priority, health score, and latency.
   */
  private _compositeScore(ep: RpcEndpoint): number {
    const priorityScore = (10 - ep.priority) * 10; // 0-90
    const latencyScore = ep.lastLatencyMs > 0
      ? Math.max(0, 100 - ep.lastLatencyMs / 50) // Penalize >500ms
      : 50; // Unknown latency gets neutral score

    return (
      priorityScore * (1 - this.config.latencyWeight) +
      ep.healthScore * 0.5 +
      latencyScore * this.config.latencyWeight
    );
  }

  /**
   * Get current endpoint status for monitoring/dashboard.
   */
  getStatus(): Array<{
    name: string;
    url: string;
    healthScore: number;
    latencyMs: number;
    consecutiveFailures: number;
    isHealthy: boolean;
  }> {
    return this.endpoints.map(ep => ({
      name: ep.name,
      url: ep.url,
      healthScore: ep.healthScore,
      latencyMs: ep.lastLatencyMs,
      consecutiveFailures: ep.consecutiveFailures,
      isHealthy: ep.healthScore > 30 && ep.consecutiveFailures < this.config.maxConsecutiveFailures,
    }));
  }

  /**
   * Start periodic health monitoring.
   */
  startMonitoring(): void {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckIntervalMs
    );
    // Initial check
    this.runHealthCheck();
  }

  /**
   * Stop health monitoring.
   */
  stopMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// EXPORTS
// ────────────────────────────────────────────────────────────────────────

export { RpcFailoverManager, type RpcEndpoint, type FailoverConfig };

// ═══════════════════════════════════════════════════════════════════════
// USAGE EXAMPLE
// ═══════════════════════════════════════════════════════════════════════
//
// import { RpcFailoverManager } from './05-RPC-FAILOVER';
// import { arc } from '../lib/wagmi';
//
// const rpcManager = new RpcFailoverManager();
// rpcManager.startMonitoring();
//
// // Create resilient client
// const client = rpcManager.createClient(arc);
//
// // Use normally — failover is transparent
// const blockNumber = await client.getBlockNumber();
//
// // Monitor health
// setInterval(() => {
//   const status = rpcManager.getStatus();
//   console.table(status);
// }, 30000);