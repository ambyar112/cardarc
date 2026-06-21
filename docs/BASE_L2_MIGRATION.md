# 🚀 BASE L2 MIGRATION GUIDE

Complete guide to deploying ArcCards on Base Layer 2 for 99% gas cost reduction.

---

## 📊 **Cost Comparison**

| Operation | Ethereum L1 | Base L2 | Savings |
|-----------|------------|---------|---------|
| Contract Deploy | $50-200 | $0.10-0.50 | **99%** |
| Single Mint | $5-15 | $0.01-0.05 | **99%** |
| Batch Mint (10x) | $50-150 | $0.10-0.30 | **99.8%** |
| NFT Transfer | $3-10 | $0.01-0.02 | **99%** |

**Real Example**: Opening 10 booster packs costs **$0.30 on Base** vs **$150 on Ethereum**.

---

## 🎯 **Why Base L2?**

1. **Instant Finality**: 2-second block times vs 12 seconds on Ethereum
2. **Native Coinbase Integration**: 110M+ potential users via Coinbase Wallet
3. **EVM Compatible**: Same Solidity code, zero contract changes needed
4. **Proven Security**: Secured by Ethereum L1, powered by Optimism
5. **Developer Experience**: Full Etherscan support, identical tooling

---

## 🛠️ **STEP 1: Environment Setup**

### 1.1 Update `.env` Configuration

Add Base network variables:

```bash
# Existing Arc Testnet config (keep for comparison)
VITE_ACTIVE_CHAIN=arc
ARC_CARDS_ADDRESS=0x...
ARC_MARKETPLACE_ADDRESS=0x...

# New Base Sepolia (Testnet) config
VITE_ACTIVE_CHAIN=baseSepolia
BASE_SEPOLIA_CARDS_ADDRESS=
BASE_SEPOLIA_MARKETPLACE_ADDRESS=

# Base Mainnet (Production) config
VITE_ACTIVE_CHAIN=base
BASE_CARDS_ADDRESS=
BASE_MARKETPLACE_ADDRESS=

# Deployment
DEPLOYER_PRIVATE_KEY=your_private_key_here
VITE_REOWN_PROJECT_ID=your_reown_project_id
```

### 1.2 Get Base Sepolia ETH (Free Testnet Funds)

Multiple faucets available:
- **Coinbase Faucet**: https://portal.cdp.coinbase.com/products/faucet
- **Alchemy Faucet**: https://www.alchemy.com/faucets/base-sepolia
- **QuickNode Faucet**: https://faucet.quicknode.com/base/sepolia

Need: ~0.05 ETH for full contract deployment + testing

---

## 🚀 **STEP 2: Deploy to Base Sepolia (Testnet)**

### 2.1 Deploy Contracts

```bash
# Deploy to Base Sepolia testnet
npx hardhat run scripts/deployBase.cjs --network baseSepolia
```

Expected output:
```
╔═══════════════════════════════════════════════════════════════╗
║  🚀 ARCC DEPLOYMENT TO BASE L2                              ║
╚═══════════════════════════════════════════════════════════════╝

Network: baseSepolia (chainId: 84532)
Deployer: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5
Balance: 0.05 ETH

📦 [1/3] Deploying ArcCardsOptimized...
✅ ArcCardsOptimized: 0x123...
   Gas used: 2,451,234

🏪 [2/3] Deploying ArcMarketplaceOptimized...
✅ ArcMarketplaceOptimized: 0x456...
   Gas used: 1,823,456

🔗 [3/3] Linking contracts...
✅ Marketplace approved as minter

╔═══════════════════════════════════════════════════════════════╗
║  ✅ DEPLOYMENT COMPLETE                                      ║
╚═══════════════════════════════════════════════════════════════╝

📋 Contract Addresses:
   ArcCardsOptimized:    0x123...
   ArcMarketplaceOptimized: 0x456...

💾 Deployment info saved to: deployments/baseSepolia-84532.json
```

### 2.2 Verify Contracts on BaseScan

```bash
# Verify ArcCards
npx hardhat verify --network baseSepolia 0x123...

# Verify Marketplace
npx hardhat verify --network baseSepolia 0x456... 0x123...
```

### 2.3 Update Frontend Config

Edit `src/lib/abi.js`:

```javascript
// Base Sepolia addresses
export const ARC_CARDS_ADDRESS = 
  import.meta.env.VITE_ACTIVE_CHAIN === 'baseSepolia' 
    ? '0x123...' // Your Base Sepolia address
    : '0xYourArcAddress...'; // Original Arc address

export const ARC_MARKETPLACE_ADDRESS = 
  import.meta.env.VITE_ACTIVE_CHAIN === 'baseSepolia'
    ? '0x456...' // Your Base Sepolia address
    : '0xYourArcMarketplace...';
```

Or use environment variables:
```javascript
export const ARC_CARDS_ADDRESS = 
  import.meta.env.VITE_ACTIVE_CHAIN === 'baseSepolia'
    ? import.meta.env.BASE_SEPOLIA_CARDS_ADDRESS
    : import.meta.env.ARC_CARDS_ADDRESS;
```

### 2.4 Test on Testnet

```bash
# Switch to Base Sepolia
echo "VITE_ACTIVE_CHAIN=baseSepolia" > .env.local

# Start dev server
npm run dev
```

**Test Checklist**:
- [ ] Connect wallet (MetaMask/Coinbase Wallet)
- [ ] Switch to Base Sepolia network
- [ ] Open booster pack (mint NFT)
- [ ] View NFT in Profile page
- [ ] List NFT on Marketplace
- [ ] Buy NFT from Marketplace
- [ ] Check transaction on BaseScan

---

## 🎯 **STEP 3: Deploy to Base Mainnet (Production)**

⚠️ **ONLY after thorough testnet testing**

### 3.1 Fund Deployer Wallet

Send **0.01 ETH** to deployer address on Base Mainnet:
- Bridge from Ethereum: https://bridge.base.org
- Buy directly on Coinbase
- Use Across Protocol: https://across.to

### 3.2 Deploy to Production

```bash
npx hardhat run scripts/deployBase.cjs --network base
```

### 3.3 Update Production Config

```bash
# .env.production
VITE_ACTIVE_CHAIN=base
BASE_CARDS_ADDRESS=0xYourProductionAddress
BASE_MARKETPLACE_ADDRESS=0xYourProductionAddress
```

### 3.4 Deploy Frontend

```bash
# Vercel deployment
vercel --prod

# Or update environment variables in Vercel dashboard
```

---

## 🔧 **STEP 4: Backend API Updates**

### 4.1 Update Supabase RPC Endpoints

Edit `src/lib/rpcProvider.ts`:

```typescript
const RPC_ENDPOINTS = {
  baseSepolia: [
    'https://sepolia.base.org',
    'https://base-sepolia.public.blastapi.io',
    'https://base-sepolia-rpc.publicnode.com',
  ],
  base: [
    'https://mainnet.base.org',
    'https://base.public.blastapi.io',
    'https://base-rpc.publicnode.com',
  ],
};
```

### 4.2 Update Webhook Validation

Edit `api/webhooks/validate.ts` to support Base chain IDs:

```typescript
const SUPPORTED_CHAIN_IDS = [
  5042002,  // Arc Testnet
  84532,    // Base Sepolia
  8453,     // Base Mainnet
];
```

### 4.3 Update Claim API

Edit `api/gacha/claim.ts` to use correct contract addresses per chain.

---

## 📈 **STEP 5: Gas Optimization Best Practices**

### 5.1 Use Batch Operations

**Before (Individual Claims)**:
```javascript
// 10 separate transactions = 10x gas + 10x confirmations
for (const card of cards) {
  await mintCardNFT(address, card);
}
```

**After (Batch Claim)**:
```javascript
// 1 transaction = 60% gas savings + instant confirmation
await mintCardBatchNFT(address, cards);
```

### 5.2 Enable Transaction Batching

The `mintCardBatchNFT` function in `src/lib/mint.js` already supports batch claims:

```javascript
// Open 10 packs at once
const cards = await openMultiplePacks(10);
const result = await mintCardBatchNFT(userAddress, cards);
```

### 5.3 Implement Gas Price Monitoring

Add gas price checking before transactions:

```javascript
import { getGasPrice } from 'viem';

const gasPrice = await getGasPrice(publicClient);
if (gasPrice > maxAcceptablePrice) {
  // Wait or notify user
}
```

---

## 🛡️ **STEP 6: Security Checklist**

Before mainnet launch:

- [ ] Smart contract audit completed
- [ ] All functions tested on testnet
- [ ] RPC failover mechanisms tested
- [ ] Rate limiting configured
- [ ] Wallet recovery flow documented
- [ ] Emergency pause functionality tested
- [ ] Admin key security (hardware wallet recommended)
- [ ] Backend signature validation tested
- [ ] Frontend input validation in place
- [ ] Error handling for all edge cases

---

## 📊 **STEP 7: Monitoring & Maintenance**

### 7.1 Transaction Monitoring

```javascript
// Track transaction success rates
const txHash = await mintCardNFT(...);
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
console.log('Gas used:', receipt.gasUsed);
```

### 7.2 Gas Cost Analytics

```javascript
// Log actual gas costs to analytics
analytics.track('transaction_complete', {
  chain: 'base',
  gasUsed: receipt.gasUsed,
  gasCostUSD: calculateUSD(receipt.gasUsed, gasPrice, ethPrice),
});
```

### 7.3 RPC Health Monitoring

The `src/lib/rpcProvider.ts` already includes automatic failover. Monitor logs for:
- RPC endpoint failures
- Fallback activation
- Response times

---

## 🚨 **Common Issues & Solutions**

### Issue: "Insufficient funds for gas"

**Solution**: Ensure wallet has ETH on Base network (not USDC).

```bash
# Check balance on Base
cast balance YOUR_ADDRESS --rpc-url https://mainnet.base.org
```

### Issue: "Chain ID mismatch"

**Solution**: Verify VITE_ACTIVE_CHAIN matches deployed network:

```javascript
// Check current chain in console
console.log('Active chain:', import.meta.env.VITE_ACTIVE_CHAIN);
console.log('Expected chain ID:', wagmiConfig.chains[0].id);
```

### Issue: "Transaction underpriced"

**Solution**: Base rarely has this issue, but if it occurs:

```javascript
// Increase gas price slightly
const gasPrice = await getGasPrice(publicClient);
const adjustedPrice = gasPrice * 110n / 100n; // +10%
```

### Issue: "Nonce already used"

**Solution**: This occurs when backend issues duplicate signatures:

```javascript
// Generate truly random nonce
function generateNonce() {
  return '0x' + crypto.getRandomValues(new Uint8Array(32))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
}
```

---

## 📚 **Additional Resources**

- **Base Documentation**: https://docs.base.org
- **BaseScan Explorer**: https://basescan.org
- **Base Bridge**: https://bridge.base.org
- **Base Status Page**: https://status.base.org
- **Coinbase Wallet**: https://www.coinbase.com/wallet

---

## 🎉 **Success Criteria**

Your migration is complete when:

✅ Contracts deployed on Base Sepolia  
✅ All functions tested on testnet  
✅ Frontend connects to Base network  
✅ Users can mint NFTs for $0.01 instead of $5  
✅ Batch operations work correctly  
✅ RPC failover tested  
✅ Contracts verified on BaseScan  
✅ Production deployment on Base Mainnet  
✅ Monitoring and analytics operational  

---

## 💡 **Next Steps After Migration**

1. **Marketing**: Highlight "99% cheaper gas fees" in all materials
2. **Coinbase Integration**: Apply for Coinbase Wallet featured apps
3. **Gas Sponsorship**: Consider Circle Gas Station for free user onboarding
4. **Analytics**: Track average gas savings per user
5. **Documentation**: Update README with Base-specific instructions

---

**Questions?** Check Base Discord or GitHub Discussions.

**Need Help?** The community is active on:
- Base Discord: https://discord.gg/buildonbase
- Base Twitter: @base
- ArcCards GitHub: Issues section