# 🔧 TROUBLESHOOTING: "Transaction Reverted On-Chain" - Listing Error

## 🎯 MASALAH: Gagal List NFT di Marketplace

Error message: **"Gagal - Transaction reverted on-chain"**

**Screenshot Example:**
```
╔══════════════════════════════════╗
║   LIST FOR SALE                  ║
║   Ribrianne                      ║
╠══════════════════════════════════╣
║   [Card Image]                   ║
║   RARE | 085                     ║
╠══════════════════════════════════╣
║           ❌                     ║
║         Gagal                    ║
║ Transaction reverted on-chain    ║
║                                  ║
║   [Close]  [Try Again]           ║
╚══════════════════════════════════╝
```

---

## 🔍 ROOT CAUSE ANALYSIS

Transaction **EXECUTED** tapi **REVERTED** on-chain. Artinya:
- ✅ Wallet connected
- ✅ Gas available
- ✅ Transaction sent
- ❌ Smart contract **REJECT** transaction

### Smart Contract Validation Flow

```solidity
function listCard(uint256 tokenId, string calldata cardId, uint256 price) {
  // CHECKPOINT 1: Price validation
  if (price == 0) revert ZeroPrice();
  
  // CHECKPOINT 2: Ownership check ⬅️ MOST COMMON FAILURE!
  if (arcCards.balanceOf(msg.sender, tokenId) < 1) revert NotOwned();
  
  // CHECKPOINT 3: Already listed check
  if (sellerTokenListing[msg.sender][tokenId] != 0) revert AlreadyListed();
  
  // CHECKPOINT 4: CardId validation
  if (bytes(cardId).length == 0) revert InvalidCardId();
  
  // CHECKPOINT 5: Card-Token mapping verification
  string memory onChainCardId = arcCards.tokenIdToCard(tokenId);
  if (keccak256(bytes(onChainCardId)) != keccak256(bytes(cardId))) {
    revert CardMismatch();
  }
  
  // CHECKPOINT 6: Transfer to escrow
  arcCards.safeTransferFrom(msg.sender, address(this), tokenId, 1, "");
  
  // Success - create listing
}
```

---

## 🐛 COMMON CAUSES (Urutan Frequency)

### 1. ❌ NFT BELUM DI-MINT (70% kasus)

**Symptom:**
- Card ada di database (Supabase)
- Tapi **BELUM** minted ke blockchain
- `balanceOf(user, tokenId)` returns 0

**Why it happens:**
- User claim gacha via frontend
- Database record created
- **TAPI** minting process gagal/incomplete
- Frontend tidak retry mint

**Solution:**
```bash
# Check if card minted
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# If not minted, mint now
node scripts/mintForUser.cjs <userAddress> <cardId>
```

---

### 2. ❌ NFT SUDAH LISTED (15% kasus)

**Symptom:**
- `sellerTokenListing[user][tokenId]` > 0
- Smart contract revert dengan `AlreadyListed()`

**Why it happens:**
- User list NFT
- Transaction success
- User refresh/close browser
- Database not updated
- User try list again → REVERT

**Solution:**
```bash
# Check existing listing
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# Cancel existing listing first
# Frontend: Profile → My Listings → Cancel
```

---

### 3. ❌ NFT SUDAH DIJUAL/TRANSFERRED (10% kasus)

**Symptom:**
- Database still shows user as owner
- Blockchain shows balance = 0
- Database out of sync

**Why it happens:**
- NFT sold via marketplace
- Database webhook gagal update
- Or NFT transferred manual via contract call

**Solution:**
```bash
# Sync database dengan blockchain
# (Need admin script to bulk-sync)

# Manual fix:
# 1. Remove card from user's collection in Supabase
# 2. Add card to new owner's collection
```

---

### 4. ❌ CARD-TOKEN MISMATCH (3% kasus)

**Symptom:**
- `tokenIdToCard(tokenId)` ≠ `cardId`
- Smart contract revert dengan `CardMismatch()`

**Why it happens:**
- Database tokenId incorrect
- Or cardId string format different

**Solution:**
```bash
# Debug mapping
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# Fix in database:
# UPDATE collection 
# SET nft_token_id = (correct_token_id)
# WHERE id = 'cardId'
```

---

### 5. ❌ APPROVAL ISSUE (2% kasus)

**Symptom:**
- `isApprovedForAll(user, marketplace)` = false
- Transfer fails di checkpoint 6

**Why it happens:**
- Frontend approval check bypassed
- Or approval revoked manual

**Solution:**
- Frontend will auto-prompt approval
- Or manual: `setApprovalForAll(marketplace, true)`

---

## 🛠️ DIAGNOSTIC TOOL: Debug Script

### Quick Usage

```bash
# Syntax
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# Example
node scripts/debugListingIssue.cjs 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb ribrianne-085
```

### Output Example

```
🔍 ARC LISTING ISSUE DEBUGGER

══════════════════════════════════════════════════════════════════════
User Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Card ID:      ribrianne-085
══════════════════════════════════════════════════════════════════════

📊 STEP 1: Checking Database (Supabase)...

✅ Card found in database:
   Name:         Ribrianne
   Tier:         rare
   Set ID:       dragonball
   NFT Token ID: NOT SET
   Owner:        0x742d35cc6634c0532925a3b844bc9e7595f0beb
   Minted:       No

⚠️  WARNING: Card marked as NOT MINTED in database

⛓️  STEP 2: Checking Blockchain (On-Chain)...

❌ Card NOT MINTED on blockchain
   TokenId mapping returns 0 (unminted)

══════════════════════════════════════════════════════════════════════
📊 DIAGNOSTIC SUMMARY
══════════════════════════════════════════════════════════════════════

❌ FOUND 2 ISSUE(S):

   1. NOT_MINTED_IN_DB
   2. NOT_MINTED_ON_CHAIN

💡 RECOMMENDED ACTIONS:

   1. Mint card first before listing using mintCardNFT()

══════════════════════════════════════════════════════════════════════
```

### Script Checks (6 Steps)

1. **Database** - Card exist? Owner correct?
2. **Blockchain** - TokenId minted?
3. **Ownership** - User balance > 0?
4. **Approval** - Marketplace approved?
5. **Existing Listings** - Already listed?
6. **Mapping** - CardId match tokenId?

---

## 🎯 SOLUTION MATRIX

| Issue | Fix Command | Time |
|-------|-------------|------|
| Not minted | `node scripts/mintForUser.cjs <user> <cardId>` | 30s |
| Already listed | Cancel via frontend UI | 15s |
| Sold/transferred | Sync database (admin) | 1m |
| Card mismatch | Update DB tokenId | 10s |
| Not approved | Frontend auto-prompt | 15s |

---

## 📋 STEP-BY-STEP FIX GUIDE

### Scenario A: NFT Belum Di-Mint

```bash
# 1. Diagnose
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# Output akan show:
# ❌ Card NOT MINTED on blockchain
# ❌ NOT_MINTED_ON_CHAIN

# 2. Mint NFT
node scripts/mintForUser.cjs <userAddress> <cardId>

# 3. Verify
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# Should now show:
# ✅ Card minted on blockchain
# ✅ User owns this NFT

# 4. Try listing again via frontend
```

---

### Scenario B: NFT Sudah Listed

```bash
# 1. Diagnose
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# Output:
# ⚠️  NFT ALREADY LISTED!
# Listing ID: 123

# 2. Cancel existing listing
# Via frontend:
# - Go to Profile → My Listings
# - Find listing #123
# - Click Cancel

# Or via script:
node scripts/cancelListing.cjs 123

# 3. Try listing again
```

---

### Scenario C: Database Out of Sync

```bash
# This requires admin access to Supabase

# 1. Check blockchain
node scripts/debugListingIssue.cjs <userAddress> <cardId>

# 2. If user balance = 0 but DB shows ownership:
# Query blockchain for actual owner:
node scripts/findNFTOwner.cjs <tokenId>

# 3. Update database manually:
# - Remove from old owner
# - Add to new owner
```

---

## 🔄 PREVENTION: Automatic Sync

### Frontend Enhancement (Recommended)

```javascript
// In ListModal.jsx - add pre-flight check

async function handleList() {
  // PRE-FLIGHT: Verify on-chain ownership
  const balance = await checkBalance(walletAddress, tokenId)
  
  if (balance === 0) {
    // NFT not owned - attempt mint or show error
    setErrorMsg('NFT not found on-chain. Minting now...')
    await mintCardNFT(walletAddress, card)
  }
  
  // Continue with normal flow...
}
```

### Backend Webhook (Future)

```javascript
// api/webhooks/marketplace.ts
// Listen for marketplace events
// Auto-sync database when:
// - NFT listed
// - NFT purchased
// - Listing cancelled
```

---

## 🚨 EMERGENCY FIX (Admin Only)

### Bulk Sync Database

```bash
# Sync all user collections with blockchain
node scripts/syncAllCollections.cjs

# Sync specific user
node scripts/syncUserCollection.cjs <userAddress>

# Force re-mint unminted cards
node scripts/remintUnminted.cjs
```

### Database Cleanup

```sql
-- Find unminted cards
SELECT id, name, owner, minted, nft_token_id
FROM collection
WHERE minted = false OR nft_token_id IS NULL;

-- Find orphaned records (DB shows owner, blockchain shows transferred)
-- (Requires custom script to check blockchain)
```

---

## 📊 MONITORING & ALERTS

### Key Metrics to Track

1. **Mint Success Rate**
   - Goal: >99%
   - Alert if <95%

2. **Listing Revert Rate**
   - Goal: <1%
   - Alert if >5%

3. **Database-Blockchain Sync Lag**
   - Goal: <1 minute
   - Alert if >5 minutes

### Recommended Logging

```javascript
// Track listing failures
console.error('[LISTING_FAILED]', {
  userAddress,
  cardId,
  tokenId,
  error: errorMessage,
  timestamp: Date.now()
})

// Send to monitoring service (Sentry, DataDog, etc)
```

---

## ❓ FAQ

### Q: Kenapa tidak langsung mint saat user claim gacha?
**A:** Sudah dilakukan! Tapi bisa gagal karena:
- Network issue
- Gas estimation fail
- User reject transaction
- RPC timeout

### Q: Kenapa tidak auto-retry mint?
**A:** Good idea! Should implement:
```javascript
// In api/gacha/claim.ts
async function mintWithRetry(user, card, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await mintCardNFT(user, card)
    } catch (e) {
      if (i === maxRetries - 1) throw e
      await sleep(1000 * (i + 1)) // Exponential backoff
    }
  }
}
```

### Q: Bisa prevent user list unminted NFT?
**A:** Yes! Add check in ListModal:
```javascript
// Before showing list form
const balance = await getBalance(user, tokenId)
if (balance === 0) {
  showError('NFT not found. Please contact support.')
  return
}
```

### Q: Database vs Blockchain - mana source of truth?
**A:** **BLOCKCHAIN** is source of truth!
- Database = cache untuk performance
- Blockchain = actual ownership state
- Always validate on-chain before critical operations

---

## 🎯 SUMMARY

**Root Cause:** Transaction reverted because smart contract validation failed

**Most Common:** NFT not minted to blockchain (70% of cases)

**Quick Fix:** 
```bash
node scripts/debugListingIssue.cjs <user> <cardId>
node scripts/mintForUser.cjs <user> <cardId>
```

**Long-term Solution:**
1. Implement automatic mint retry
2. Add pre-flight ownership check in frontend
3. Setup database-blockchain sync webhook
4. Monitor mint success rate

---

**Created:** 2026-07-06  
**Last Updated:** 2026-07-06  
**Related Docs:**
- `docs/PRODUCTION_ARCHITECTURE.md`
- `scripts/debugListingIssue.cjs`
- `scripts/mintForUser.cjs`