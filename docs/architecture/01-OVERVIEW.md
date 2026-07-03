# ═══════════════════════════════════════════════════════════════════════
# QUANTUM ARCHITECTURE BLUEPRINT — ArcCards dApp
# ═══════════════════════════════════════════════════════════════════════
# Production-Grade Web3 Infrastructure | Hyper-Scalable Topology
# Generated: 2026-06-23 | Status: PRODUCTION-READY

## SYSTEM TOPOLOGY

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Next.js / Vite)                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ React UI │──│ Wagmi + Viem │──│ Reown AppKit (WalletConnect)│
│  └──────────┘  └──────┬───────┘  └──────────────────────────┘  │
│                       │                                         │
│  ┌────────────────────┴────────────────────────────────────┐   │
│  │         RPC FAILOVER ORCHESTRATOR                        │   │
│  │  Primary: rpc.testnet.arc.network                        │   │
│  │  Viem fallback() transport with latency-based ranking    │   │
│  └────────────────────┬────────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────────────┐
│              EDGE / API LAYER (Vercel Serverless)               │
│  ┌────────────────────┴────────────────────────────────────┐   │
│  │  /api/gacha/claim   — Gacha mint via backend signature   │   │
│  │  /api/seed          — Database seeder (dev only)         │   │
│  │  /api/metadata/*    — ERC-1155 metadata URIs             │   │
│  │  /api/faucet        — Testnet token distribution         │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                         │
│  ┌────────────────────┴────────────────────────────────────┐   │
│  │  SECURITY PERIMETER                                      │   │
│  │  • HMAC-SHA256 webhook signature validation              │   │
│  │  • Sliding-window timestamp verification (±300s)         │   │
│  │  • EIP-712 typed data signing for gacha claims           │   │
│  │  • Rate limiting per wallet address                      │   │
│  └────────────────────┬────────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────────────┐
│              DATA LAYER (Supabase PostgreSQL)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ profiles │  │collection│  │gacha_log │  │ marketplace  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────────┐                        │
│  │faucet_claims │  │ transaction_ledger│  ← NEW               │
│  └──────────────┘  └──────────────────┘                        │
│                                                                 │
│  RLS Policies: wallet-scoped read/write isolation               │
│  Indexes: composite on (wallet, card_id), (status, created_at)  │
└─────────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────────────┐
│              ON-CHAIN LAYER (Arc Network 333)                   │
│  ┌──────────────────┐  ┌──────────────────────────────────┐    │
│  │  ArcCards.sol    │  │  ArcMarketplace.sol               │    │
│  │  ERC-1155 NFT    │  │  Escrow-based P2P trading         │    │
│  │  • claimMint     │  │  • list / buy / cancel            │    │
│  │  • mintCardBatch │  │  • 2.5% platform fee              │    │
│  │  • Minter ACL    │  │  • ReentrancyGuard                │    │
│  └──────────────────┘  └──────────────────────────────────┘    │
│                                                                 │
│  Events emitted: CardMinted, Listed, Purchased, Cancelled       │
│  Gas optimizations: custom errors, packed structs, batch ops    │
└─────────────────────────────────────────────────────────────────┘
```

## KEY DESIGN DECISIONS

### 1. Wallet State Machine
- Wagmi + Reown AppKit for multi-wallet support (MetaMask, WalletConnect, Coinbase)
- sessionStorage-based browser-session detection → auto-disconnect on browser close
- 4-hour TTL session expiry with visibility-change enforcement
- Zero CLS: skeleton states during hydration, no layout shifts on connect/disconnect

### 2. Hybrid Indexing Strategy
- On-chain: Authoritative source for ownership, transfers, marketplace state
- Off-chain (Supabase): Fast queries for collection display, gacha logs, leaderboards
- Sync: Backend writes to Supabase after confirmed on-chain tx (≥1 confirmation)
- Cache-Aside: Redis for hot data (balances, active listings) with 30s TTL

### 3. Smart Contract Security
- Checks-Effects-Interactions pattern throughout
- ReentrancyGuard on all state-mutating external functions
- Custom errors (gas-efficient) instead of require strings
- Nonce-based replay protection on claimMint
- On-chain cardId↔tokenId verification prevents spoofing

### 4. RPC Resilience
- Viem `fallback()` transport with automatic latency-based ranking
- 30s timeout per endpoint, 5 retries with exponential backoff
- Health monitoring with 30s check intervals
- Error classification: rate-limit, network, server errors → all retryable

## FILES INDEX

| File | Description |
|------|-------------|
| `02-WALLET-STATE-MACHINE.ts` | Production React hook for wallet lifecycle |
| `03-DATABASE-SCHEMA.sql` | Complete PostgreSQL DDL with RLS |
| `04-ARC-CARDS-CONTRACT.sol` | Optimized ERC-1155 contract |
| `05-MARKETPLACE-CONTRACT.sol` | Escrow marketplace contract |
| `06-RPC-FAILOVER.ts` | Multi-endpoint failover with health monitoring |
| `07-WEBHOOK-SECURITY.ts` | HMAC + timestamp validation for webhooks |
| `08-REDIS-CACHE.ts` | Cache-Aside / Write-Through caching layer |