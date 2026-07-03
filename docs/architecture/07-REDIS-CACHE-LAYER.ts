/**
 * ═══════════════════════════════════════════════════════════════════════
 * REDIS CACHE LAYER — High-Throughput Caching Strategy
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURE:
 * - Cache-Aside pattern for read-heavy endpoints
 * - Write-Through for critical data consistency
 * - TTL-based expiration (30s-5m depending on data volatility)
 * - Automatic invalidation on blockchain events
 *
 * WHY REDIS:
 * - Sub-millisecond latency (vs 10-50ms for PostgreSQL)
 * - Reduces database load by 80-90% for hot keys
 * - Prevents rate-limit exhaustion on RPC nodes
 * - Scales horizontally with Redis Cluster
 *
 * CACHING TARGETS:
 * 1. User profiles (wallet → profile data)
 * 2. Active marketplace listings (sorted by price/time)
 * 3. Blockchain state (block number, gas price)
 * 4. NFT balances (wallet → card collection)
 * 5. Leaderboard snapshots (top 100 players)
 */

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

// ────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────

interface CacheConfig {
  url: string;
  ttl: {
    profile: number;
    marketplace: number;
    blockchain: number;
    nftBalance: number;
    leaderboard: number;
  };
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

// ────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: CacheConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  ttl: {
    profile: 300,      // 5 minutes (infrequent changes)
    marketplace: 30,   // 30 seconds (high volatility)
    blockchain: 10,    // 10 seconds (block time)
    nftBalance: 60,    // 1 minute (updated on mint/transfer)
    leaderboard: 300,  // 5 minutes (background refresh)
  },
};

// ────────────────────────────────────────────────────────────────────────
// CACHE MANAGER
// ────────────────────────────────────────────────────────────────────────

class RedisCacheManager {
  private client: RedisClientType | null = null;
  private config: CacheConfig;
  private isConnected = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize Redis connection.
   * Call this once on app startup.
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.client = createClient({
      url: this.config.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error('Max retries reached');
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
    });

    this.client.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });

    await this.client.connect();
    this.isConnected = true;
    console.log('[Redis] Connected successfully');
  }

  /**
   * Gracefully disconnect.
   * Call on app shutdown.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // CACHE-ASIDE PATTERN
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Get from cache. If miss, fetch from DB and populate cache.
   * 
   * @example
   * const profile = await cache.getOrFetch(
   *   `profile:${wallet}`,
   *   () => supabase.from('profiles').select('*').eq('wallet', wallet),
   *   cache.config.ttl.profile
   * );
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    if (!this.client) throw new Error('Redis not connected');

    // Try cache first
    const cached = await this.client.get(key);
    if (cached) {
      try {
        const entry: CacheEntry<T> = JSON.parse(cached);
        // Check if still valid (client-side TTL check)
        if (Date.now() < entry.expiresAt) {
          return entry.data;
        }
      } catch {
        // Invalid JSON, proceed to fetch
      }
    }

    // Cache miss or expired → fetch from source
    const data = await fetchFn();

    // Populate cache (fire-and-forget to not block response)
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
    };
    this.client.setEx(key, ttl, JSON.stringify(entry)).catch((err) => {
      console.error(`[Redis] Failed to cache key ${key}:`, err);
    });

    return data;
  }

  /**
   * Set cache entry with TTL.
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.client) return;

    const entry: CacheEntry<T> = {
      data: value,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
    };

    await this.client.setEx(key, ttl, JSON.stringify(entry));
  }

  /**
   * Get cache entry.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    const cached = await this.client.get(key);
    if (!cached) return null;

    try {
      const entry: CacheEntry<T> = JSON.parse(cached);
      if (Date.now() < entry.expiresAt) {
        return entry.data;
      }
      // Expired, delete
      this.client.del(key);
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate (delete) cache entry.
   * Call when underlying data changes.
   */
  async invalidate(key: string | string[]): Promise<void> {
    if (!this.client) return;
    const keys = Array.isArray(key) ? key : [key];
    await this.client.del(keys);
  }

  /**
   * Invalidate all keys matching pattern.
   * Use sparingly — O(N) operation.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.client) return;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // SPECIALIZED CACHE OPERATIONS
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Cache user profile.
   * Invalidate on profile update.
   */
  async cacheProfile(wallet: string, profile: unknown): Promise<void> {
    await this.set(`profile:${wallet.toLowerCase()}`, profile, this.config.ttl.profile);
  }

  async getProfile(wallet: string): Promise<unknown | null> {
    return this.get(`profile:${wallet.toLowerCase()}`);
  }

  async invalidateProfile(wallet: string): Promise<void> {
    await this.invalidate(`profile:${wallet.toLowerCase()}`);
  }

  /**
   * Cache marketplace listings (sorted set by price).
   * Redis ZSET enables efficient range queries.
   */
  async cacheActiveListings(listings: Array<{ id: string; price: number }>): Promise<void> {
    if (!this.client) return;

    const key = 'marketplace:active';
    await this.client.del(key);

    if (listings.length > 0) {
      const members = listings.map((l) => ({
        score: l.price,
        value: l.id,
      }));
      await this.client.zAdd(key, members);
      await this.client.expire(key, this.config.ttl.marketplace);
    }
  }

  async getActiveListings(limit = 50): Promise<string[]> {
    if (!this.client) return [];
    return this.client.zRange('marketplace:active', 0, limit - 1);
  }

  /**
   * Cache NFT balance for a wallet.
   * Invalidate on mint/transfer events.
   */
  async cacheNftBalance(wallet: string, balance: unknown): Promise<void> {
    await this.set(`nft:${wallet.toLowerCase()}`, balance, this.config.ttl.nftBalance);
  }

  async getNftBalance(wallet: string): Promise<unknown | null> {
    return this.get(`nft:${wallet.toLowerCase()}`);
  }

  async invalidateNftBalance(wallet: string): Promise<void> {
    await this.invalidate(`nft:${wallet.toLowerCase()}`);
  }

  /**
   * Cache leaderboard snapshot.
   * Refreshed every 5 minutes by background job.
   */
  async cacheLeaderboard(data: unknown): Promise<void> {
    await this.set('leaderboard:top100', data, this.config.ttl.leaderboard);
  }

  async getLeaderboard(): Promise<unknown | null> {
    return this.get('leaderboard:top100');
  }

  /**
   * Cache blockchain state (block number, gas price).
   */
  async cacheBlockchainState(state: { blockNumber: bigint; gasPrice: bigint }): Promise<void> {
    await this.set('blockchain:state', state, this.config.ttl.blockchain);
  }

  async getBlockchainState(): Promise<{ blockNumber: bigint; gasPrice: bigint } | null> {
    return this.get('blockchain:state');
  }
}

// ────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ────────────────────────────────────────────────────────────────────────

let cacheInstance: RedisCacheManager | null = null;

export function getCacheManager(): RedisCacheManager {
  if (!cacheInstance) {
    cacheInstance = new RedisCacheManager();
  }
  return cacheInstance;
}

export { RedisCacheManager };

// ═══════════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ═══════════════════════════════════════════════════════════════════════
//
// // 1. Initialize on app startup
// const cache = getCacheManager();
// await cache.connect();
//
// // 2. Cache-Aside for profile endpoint
// app.get('/api/profile/:wallet', async (req, res) => {
//   const profile = await cache.getOrFetch(
//     `profile:${req.params.wallet}`,
//     () => supabase.from('profiles').select('*').eq('wallet', req.params.wallet).single(),
//     cache.config.ttl.profile
//   );
//   res.json(profile);
// });
//
// // 3. Invalidate on update
// app.put('/api/profile', async (req, res) => {
//   await supabase.from('profiles').update(req.body).eq('wallet', req.body.wallet);
//   await cache.invalidateProfile(req.body.wallet);
//   res.json({ success: true });
// });
//
// // 4. Blockchain event listener → invalidate balance
// contract.on('Transfer', async (from, to, tokenId) => {
//   await cache.invalidateNftBalance(from);
//   await cache.invalidateNftBalance(to);
// });
//
// // 5. Background job: refresh leaderboard
// setInterval(async () => {
//   const leaderboard = await supabase.from('leaderboard_snapshot').select('*').limit(100);
//   await cache.cacheLeaderboard(leaderboard);
// }, 5 * 60 * 1000);