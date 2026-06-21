# 🎯 Arc Network Migration - Complete Guide

## ✅ Status: Configuration Complete - Deployment Required

All code has been successfully configured to use **Arc Testnet exclusively**. The final step is deploying contracts and updating environment variables.

---

## 📋 What's Been Done

### 1. Chain Configuration ✅
- **wagmi.js**: Configured to use Arc Testnet only (Chain ID: 5042002)
- **rpcProvider.ts**: RPC failover configured for Arc Testnet
- **hardhat.config.cjs**: Network config points to Arc Testnet
- **useWalletConnection.ts**: Explorer links use arcscan.app

### 2. Contract Code ✅
- ArcCards and ArcMarketplace contracts are ready
- Optimized for Arc Network's lower gas costs
- Security patches applied

### 3. Frontend Integration ✅
- All wallet interactions use Arc Testnet
- Mint, list, and marketplace functions configured
- Block explorer links updated

---

## 🚨 Action Required: Deploy Contracts to Arc Testnet

### Step 1: Prepare Deployment Wallet

You need a wallet with **USDC on Arc Testnet** to deploy contracts:

```bash
# Get Arc Testnet USDC from faucet
# Visit: https://faucet.arc.network (if available)
# Or bridge USDC to Arc Testnet
```

### Step 2: Set Deployment Private Key

Create or update `.env`:

```bash
# .env
DEPLOYER_PRIVATE_KEY=your_private_key_here
```

⚠️ **Security**: NEVER commit `.env` to git. It's already in `.gitignore`.

### Step 3: Deploy Contracts

```bash
# Deploy both contracts to Arc Testnet
npx hardhat run scripts/deployBase.cjs --network arcTestnet
```

Expected output:
```
Deploying ArcCards...
ArcCards deployed to: 0x...
Deploying ArcMarketplace...
ArcMarketplace deployed to: 0x...
Setting up marketplace approval...
✅ Deployment complete!
```

### Step 4: Update Environment Variables

After deployment, update `.env` with new contract addresses:

```bash
# .env
VITE_CONTRACT_ADDRESS=0xYourNewArcCardsAddress
VITE_MARKETPLACE_ADDRESS=0xYourNewArcMarketplaceAddress
VITE_REOWN_PROJECT_ID=your_reown_project_id
VITE_APP_URL=https://cardarc.vercel.app
```

### Step 5: Verify on ArcScan

Visit ArcScan to confirm deployment:
```
https://testnet.arcscan.app/address/0xYourNewArcCardsAddress
https://testnet.arcscan.app/address/0xYourNewArcMarketplaceAddress
```

### Step 6: Test Locally

```bash
# Install dependencies (if needed)
npm install

# Start dev server
npm run dev
```

Test these features:
- ✅ Wallet connection (should show Arc Testnet)
- ✅ Gacha pack opening
- ✅ Card minting
- ✅ Marketplace listing
- ✅ Marketplace purchase

### Step 7: Deploy to Vercel

```bash
# Push to GitHub
git add .
git commit -m "Arc Network migration complete - ready for deployment"
git push origin main

# Vercel will auto-deploy if connected
# Or manually: vercel --prod
```

Don't forget to set environment variables in Vercel dashboard:
- `VITE_CONTRACT_ADDRESS`
- `VITE_MARKETPLACE_ADDRESS`
- `VITE_REOWN_PROJECT_ID`
- `VITE_APP_URL`

---

## 🔍 Current Contract Addresses (OUTDATED - Base Sepolia)

⚠️ These addresses are from Base Sepolia and will NOT work on Arc Testnet:

```
ArcCards:       0x00B4add7c37E70690EEE4d14C222e50B926cd2E5 (Base Sepolia)
ArcMarketplace: 0x2Cee9C1AAd5626C63630aF47641157082F982BbC (Base Sepolia)
```

You MUST deploy new contracts to Arc Testnet and update `.env`.

---

## 📊 Arc Network vs Base Sepolia

| Feature | Base Sepolia | Arc Testnet |
|---------|-------------|-------------|
| Chain ID | 84532 | 5042002 |
| Native Token | ETH | USDC |
| Gas Cost | ~0.0001 ETH | ~0.0001 USDC |
| Block Time | ~2s | ~2s |
| RPC | base-sepolia.g.alchemy.com | rpc.testnet.arc.network |
| Explorer | sepolia.basescan.org | testnet.arcscan.app |

---

## 🛠️ Troubleshooting

### Problem: "Wrong Network" Error
**Solution**: Make sure wallet is connected to Arc Testnet (Chain ID: 5042002)

### Problem: "Contract not found"
**Solution**: Deploy contracts to Arc Testnet first (see Step 3)

### Problem: "Insufficient USDC"
**Solution**: Get USDC from Arc Testnet faucet

### Problem: Mint/List/Purchase fails
**Solution**: 
1. Verify contract addresses in `.env` are correct
2. Check wallet has USDC for gas
3. Confirm transaction on arcscan.app

---

## 📁 Modified Files Summary

### Configuration Files
- ✅ `src/lib/wagmi.js` - Arc Testnet only
- ✅ `hardhat.config.cjs` - Arc Testnet network config
- ✅ `src/lib/rpcProvider.ts` - Arc RPC endpoints
- ✅ `src/hooks/useWalletConnection.ts` - ArcScan explorer

### Contract Files (Ready for Deployment)
- ✅ `contracts/ArcCards.sol`
- ✅ `contracts/ArcMarketplace.sol`
- ✅ `scripts/deployBase.cjs`

### Frontend Files
- ✅ `src/lib/abi.js` - Contract ABIs and addresses
- ✅ `src/lib/mint.js` - Minting functions
- ✅ `src/lib/marketplace.js` - Marketplace functions
- ✅ `src/components/ListModal.jsx` - Listing UI

---

## 🎉 Next Steps

1. **Deploy contracts** to Arc Testnet (Step 3 above)
2. **Update `.env`** with new addresses (Step 4 above)
3. **Test locally** (Step 6 above)
4. **Deploy to production** (Step 7 above)

---

## 📞 Support

If you encounter issues:
1. Check ArcScan for transaction status
2. Verify contract addresses in `.env`
3. Ensure wallet is on Arc Testnet
4. Review console logs for errors

---

**Last Updated**: June 22, 2026  
**Migration Status**: ✅ Code Complete - Awaiting Contract Deployment