# ArcCards — Product Overview

ArcCards is a Web3 trading card game dApp where users collect, trade, and showcase digital cards from franchises like Pokémon, Yu-Gi-Oh!, Dragon Ball, Digimon, One Piece, and Gundam. It runs on **Arc Testnet** (Chain ID: 5042002), a custom L2 network.

## Core Features

- **Gacha system** — Open card packs to pull cards with rarity weights. Backend validates pulls before issuing mint authorization signatures.
- **NFT collection** — Cards are ERC-1155 tokens (`ArcCardsOptimized`). Each card type has a string `cardId` mapped to an on-chain `tokenId`.
- **Marketplace** — Peer-to-peer card trading via `ArcMarketplaceOptimized`. Sellers list by tokenId; buyers pay in native ETH.
- **Leaderboard & Profile** — Off-chain ranking and collection stats backed by Supabase.
- **Faucet** — Test token/ETH distribution for the Arc Testnet.

## Deployed Contracts (Arc Testnet)

| Contract | Address |
|---|---|
| ArcCards (ERC-1155) | `VITE_CONTRACT_ADDRESS` env var |
| ArcMarketplace | `VITE_MARKETPLACE_ADDRESS` env var |

Contract addresses are injected at build time via Vite env vars — never hardcode them in source.

## Live URL

https://cardarc.vercel.app
