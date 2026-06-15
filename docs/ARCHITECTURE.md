# ArcCards Web3 dApp - Production Architecture Blueprint

## Overview

ArcCards adalah platform NFT trading card berbasis Web3 dengan arsitektur hybrid Web2/Web3. Platform ini mengintegrasikan smart contracts ERC-1155 dengan backend indexing layer dan caching untuk performa optimal.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│  React + Vite + TypeScript                                          │
│  ├── Wallet Connection (Wagmi + Reown AppKit)                       │
│  ├── RPC Failover Provider                                          │
│  ├── Cache Manager (In-Memory LRU)                                  │
│  └── Security Layer (HMAC Validation)                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BLOCKCHAIN LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Arc Testnet (Chain ID: 5042002)                                    │
│  ├── ArcCards ERC-1155 Contract                                     │
│  └── ArcMarketplace Escrow Contract                                 │
│                                                                      │
│  RPC Endpoints (Failover Chain):                                    │
│  ├── Primary: rpc.testnet.arc.network                               │
│  └── Fallback: Multi-provider support                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL 15+)                                          │
│  ├── profiles (User profiles)                                       │
│  ├── collection (NFT holdings)                                      │
│  ├── gacha_log (Pull history)                                       │
│  ├── marketplace (Listings)                                         │
│  ├── transaction_ledgers (Financial tracking)                       │
│  ├── faucet_claims (Daily claims)                                   │
│  └── audit_logs (System audit trail)                                │
│                                                                      │
│  Features:                                                           │
│  ├── Row Level Security (RLS)                                       │
│  ├── Automatic timestamp triggers                                   │
│  └── Wallet normalization triggers                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. Wallet Connection Layer (`src/hooks/useWalletConnection.ts`)

**Purpose**: Mengelola state koneksi wallet dengan zero-latency UX

**Features**:
- Multi-wallet support via Reown AppKit
- Session persistence (localStorage, 7-day TTL)
- Chain switching dengan graceful notifications
- Block explorer integration
- Hydration mismatch prevention

**Usage**:
```typescript
import { useWalletConnection } from '@/hooks/useWalletConnection';

function MyComponent() {
  const { wallet, actions, error } = useWalletConnection();
  
  if (!wallet.isConnected) {
    return <button onClick={actions.connect}>Connect Wallet</button>;
  }
  
  return (
    <div>
      <p>Address: {wallet.address}</p>
      <p>Balance: {wallet.balance?.toString()} wei</p>
      <button onClick={actions.disconnect}>Disconnect</button>
    </div>
  );
}
```

### 2. RPC Failover System (`src/lib/rpcProvider.ts`)

**Purpose**: Menjamin availability RPC endpoint dengan automatic failover

**Architecture**:
```
Request → Health Monitor → [Provider 1] → Success
                         ↓ (fail)
                      [Provider 2] → Success
                         ↓ (fail)
                      [Provider 3] → Success
                         ↓ (all fail)
                      Retry with Exponential Backoff
```

**Features**:
- Health check monitoring (30s interval)
- Latency-based ranking
- Automatic provider rotation
- Exponential backoff with jitter
- Error classification (retryable vs fatal)

**Usage**:
```typescript
import { getPublicClient, retryWithBackoff, isRetryableError } from '@/lib/rpcProvider';

// Get cached client
const client = getPublicClient(5042002);

// With retry logic
const blockNumber = await retryWithBackoff(
  () => client.getBlockNumber(),
  { maxRetries: 3, shouldRetry: isRetryableError }
);
```

### 3. Cache Manager (`src/lib/cacheManager.ts`)

**Purpose**: Mengurangi redundant RPC queries dengan intelligent caching

**Pattern**: Cache-Aside dengan LRU eviction

**Specialized Caches**:
| Cache | TTL | Max Size | Use Case |
|-------|-----|----------|----------|
| balanceCache | 30s | 500 | Wallet balances |
| nftMetadataCache | 1h | 1000 | Immutable NFT data |
| marketplaceCache | 5m | 500 | Active listings |
| profileCache | 10m | 300 | User profiles |
| transactionCache | 1h | 200 | Confirmed transactions |

**Usage**:
```typescript
import { balanceCache } from '@/lib/cacheManager';

// Get or fetch
const balance = await balanceCache.getOrSet(
  `balance:${address}`,
  () => client.getBalance({ address }),
  30000 // Custom TTL
);

// Direct set
balanceCache.set(`balance:${address}`, balance, 30000);

// Statistics
const stats = balanceCache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

### 4. Security Layer (`src/lib/security.ts`)

**Purpose**: Melindungi backend dari malicious requests

**Features**:
- HMAC-SHA256 signature validation
- Timestamp sliding window (5 min)
- Nonce replay prevention (1 hour TTL)
- Ethereum address checksum validation
- Rate limiting per wallet (100 req/min)

**Webhook Validation Flow**:
```
1. Check timestamp within ±5 min window
2. Verify nonce not previously used
3. Validate HMAC signature
4. Register nonce to prevent replay
5. Process payload
```

**Usage**:
```typescript
import { validateWebhook, isValidEthereumAddress } from '@/lib/security';

// Validate webhook
const result = await validateWebhook(payload);
if (!result.valid) {
  return { error: result.reason };
}

// Validate address
if (!isValidEthereumAddress(userInput)) {
  return { error: 'Invalid address format' };
}
```

## Smart Contracts

### ArcCardsOptimized.sol

**Optimizations**:
- Custom errors (~50% gas savings vs require strings)
- `unchecked` blocks for safe arithmetic
- Storage packing untuk minimal slots
- Batch minting untuk efficiency
- Pausable emergency mechanism

**Key Functions**:
| Function | Access | Purpose |
|----------|--------|---------|
| `mintCard(address, cardId)` | Minter | Mint single card |
| `mintCardBatch(address, cardIds[])` | Minter | Batch mint up to 100 |
| `claimMint(cardId, nonce, signature)` | User | Backend-signed gasless mint |
| `burnCard(tokenId, amount)` | User | Burn owned cards |

**Security Measures**:
- `SC-01`: Removed permissionless selfMint
- Signature verification (EIP-191)
- Nonce replay prevention

### ArcMarketplaceOptimized.sol

**Pattern**: Escrow-based dengan CEI (Checks-Effects-Interactions)

**Flow**:
```
List: Card → Escrow → Listing Created
Buy:   Payment → Seller (minus fee) → Card → Buyer
Cancel: Card → Seller → Listing Cancelled
```

**Key Functions**:
| Function | Access | Purpose |
|----------|--------|---------|
| `listCard(tokenId, cardId, price)` | User | List card for sale |
| `purchase(listingId)` | User | Buy listed card |
| `cancelListing(listingId)` | Seller | Cancel and reclaim |
| `updatePrice(listingId, newPrice)` | Seller | Adjust price |

**Security Measures**:
- `SC-02`: On-chain cardId verification prevents spoofing
- `SC-03`: Emergency withdraw with event logging
- ReentrancyGuard protection

## Database Schema

### Key Tables

#### `profiles`
```sql
- id: uuid (PK)
- wallet: text (UNIQUE, indexed)
- username: text (UNIQUE)
- level: int (1-999)
- legendary_count: int
- arc_volume: numeric(20,2)
- last_active_at: timestamptz
```

#### `transaction_ledgers`
```sql
- id: uuid (PK)
- wallet: text (FK → profiles)
- tx_hash: text (UNIQUE)
- tx_type: enum (mint, transfer, sale, burn, gacha)
- status: enum (pending, confirmed, failed, reverted)
- block_number: bigint
- gas_used: numeric(20,0)
- amount: numeric(20,2)
```

#### `marketplace`
```sql
- id: uuid (PK)
- on_chain_listing_id: bigint (UNIQUE)
- seller: text (FK → profiles)
- buyer: text (FK → profiles)
- card_id: text
- price_wei: numeric(20,0)
- price_usdc: numeric(20,2)
- status: enum (active, sold, cancelled, expired)
```

### Indexing Strategy

**Critical Indexes**:
- `idx_profiles_wallet_lower`: Case-insensitive wallet lookup
- `idx_marketplace_status_price`: Filter active listings by price
- `idx_tx_ledger_wallet`: User transaction history
- `idx_collection_wallet_tier`: User cards by rarity

## Environment Variables

```bash
# .env.local
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_WEBHOOK_SECRET=your-secret-key
VITE_ARC_CARDS_ADDRESS=0x...
VITE_ARC_MARKETPLACE_ADDRESS=0x...

# .env (server-side, never expose)
DEPLOYER_PRIVATE_KEY=0x...
```

## Deployment Checklist

### Smart Contracts

```bash
# Compile
npx hardhat compile

# Deploy to Arc Testnet
npx hardhat run scripts/deploy.cjs --network arc

# Verify (if applicable)
npx hardhat verify --network arc <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Frontend

```bash
# Install dependencies
npm install

# Build
npm run build

# Deploy to Vercel
vercel --prod
```

### Database

1. Run `supabase_schema.sql` first (base tables)
2. Run `supabase_schema_enhanced.sql` (enhancements)
3. Verify RLS policies are active

## Monitoring & Maintenance

### Cache Statistics
```typescript
// Monitor cache performance
import { balanceCache, nftMetadataCache } from '@/lib/cacheManager';

console.log({
  balance: balanceCache.getStats(),
  nft: nftMetadataCache.getStats()
});
```

### RPC Health Check
```typescript
import { checkRpcHealth } from '@/lib/rpcProvider';

// Health check all providers
const health = await checkRpcHealth(5042002);
// Returns: [{ url, isHealthy, latency, failureCount }]
```

### Database Health
```sql
-- Check table sizes
SELECT 
  schemaname,
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Check index usage
SELECT 
  relname,
  indexrelname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Troubleshooting

### Common Issues

**1. Wallet not connecting**
- Clear localStorage session
- Check network is Arc Testnet
- Verify AppKit configuration

**2. RPC timeouts**
- Health monitor will auto-switch providers
- Check `getRpcHealthStatus()` for provider status

**3. Transaction pending**
- Check `transaction_ledgers` for status
- Verify RPC endpoint is responding
- Check block explorer for tx hash

**4. Cache invalidation**
- Call `cache.clear()` for specific cache
- Check TTL settings
- Monitor eviction statistics

## Security Best Practices

1. **Never expose private keys** in frontend code
2. **Validate all inputs** before blockchain interaction
3. **Use webhooks** with signature validation for backend events
4. **Rate limit** per wallet address
5. **Log all transactions** in audit_logs table
6. **Enable RLS** on all tables
7. **Use parameterized queries** for database operations

---

Last Updated: 2026-06-15
Version: 2.0.0