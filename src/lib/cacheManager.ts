/**
 * ═══════════════════════════════════════════════════════════════════════
 * HIGH-THROUGHPUT CACHING LAYER
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * In-memory caching with Redis-compatible interface for:
 * - Cache-Aside pattern for read-heavy operations
 * - Write-Through caching for consistency
 * - Automatic TTL management
 * - Memory-efficient LRU eviction
 * - Typed cache entries
 */

// ────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size
  enableStats?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  hitRate: number;
}

// ────────────────────────────────────────────────────────────────────────
// CACHE MANAGER CLASS
// ────────────────────────────────────────────────────────────────────────

export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private accessOrder: string[]; // For LRU tracking
  private maxSize: number;
  private defaultTtl: number;
  private enableStats: boolean;
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.enableStats = options.enableStats ?? true;
  }

  // ──────────────────────────────────────────────────────────────────────
  // GET
  // ──────────────────────────────────────────────────────────────────────

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.enableStats) this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      if (this.enableStats) this.stats.misses++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    entry.hits++;
    
    if (this.enableStats) this.stats.hits++;
    return entry.data as T;
  }

  // ──────────────────────────────────────────────────────────────────────
  // SET
  // ──────────────────────────────────────────────────────────────────────

  set<T>(key: string, data: T, ttl?: number): void {
    // Check cache size and evict if necessary
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const expirationTime = ttl || this.defaultTtl;
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + expirationTime,
      hits: 0,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    
    if (this.enableStats) this.stats.sets++;
  }

  // ──────────────────────────────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────────────────────────────

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
      if (this.enableStats) this.stats.deletes++;
    }
    return deleted;
  }

  // ──────────────────────────────────────────────────────────────────────
  // HAS
  // ──────────────────────────────────────────────────────────────────────

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }
    
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────
  // CLEAR
  // ──────────────────────────────────────────────────────────────────────

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  // ──────────────────────────────────────────────────────────────────────
  // GET OR SET (Cache-Aside Pattern)
  // ──────────────────────────────────────────────────────────────────────

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    const data = await factory();
    this.set(key, data, ttl);
    return data;
  }

  // ──────────────────────────────────────────────────────────────────────
  // LRU EVICTION
  // ──────────────────────────────────────────────────────────────────────

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder[0];
    this.cache.delete(keyToEvict);
    this.accessOrder.shift();
    
    if (this.enableStats) this.stats.evictions++;
  }

  // ──────────────────────────────────────────────────────────────────────
  // ACCESS ORDER MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────

  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // STATISTICS
  // ──────────────────────────────────────────────────────────────────────

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      evictions: this.stats.evictions,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // CLEANUP EXPIRED ENTRIES
  // ──────────────────────────────────────────────────────────────────────

  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ────────────────────────────────────────────────────────────────────────
// SPECIALIZED CACHES
// ────────────────────────────────────────────────────────────────────────

// Balance cache - short TTL for frequently changing data
export const balanceCache = new CacheManager({
  ttl: 30 * 1000, // 30 seconds
  maxSize: 500,
});

// NFT metadata cache - longer TTL for immutable data
export const nftMetadataCache = new CacheManager({
  ttl: 60 * 60 * 1000, // 1 hour
  maxSize: 1000,
});

// Marketplace listings cache - medium TTL
export const marketplaceCache = new CacheManager({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 500,
});

// User profile cache - medium TTL
export const profileCache = new CacheManager({
  ttl: 10 * 60 * 1000, // 10 minutes
  maxSize: 300,
});

// Transaction cache - longer TTL for confirmed txs
export const transactionCache = new CacheManager({
  ttl: 60 * 60 * 1000, // 1 hour
  maxSize: 200,
});

// ────────────────────────────────────────────────────────────────────────
// PERIODIC CLEANUP (with proper memory leak prevention)
// ────────────────────────────────────────────────────────────────────────

// Store interval reference at module level for cleanup
let cleanupInterval: NodeJS.Timeout | null = null;

// Run cleanup every 5 minutes
if (typeof window !== 'undefined') {
  cleanupInterval = setInterval(() => {
    balanceCache.cleanupExpired();
    nftMetadataCache.cleanupExpired();
    marketplaceCache.cleanupExpired();
    profileCache.cleanupExpired();
    transactionCache.cleanupExpired();
  }, 5 * 60 * 1000);
}

/**
 * Stop periodic cleanup interval
 * Call this to prevent memory leaks when cache manager is no longer needed
 */
export function stopPeriodicCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[CacheManager] Periodic cleanup stopped');
  }
}
