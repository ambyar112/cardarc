# 🔍 MCP TOOLS ANALYSIS - ArcCards Debugging

## ✅ MCP YANG TERSEDIA:

### 1. **browser-tools-mcp** (AgentDeskAI)
**Status:** ⚠️ Connector tidak running
**Kapabilitas:**
- `getConsoleLogs` - Check console output
- `getConsoleErrors` - Check error messages  
- `getNetworkLogs` - Check network requests (paling penting!)
- `takeScreenshot` - Visual debugging
- `runDebuggerMode` - Automated debugging

**Kenapa Penting:**
- Bisa lihat contract address yang sebenarnya dipanggil
- Bisa lihat transaction details
- Bisa capture exact error messages

**Problem:** Browser connector server tidak running!

**Solution:** User perlu start browser connector dulu.

---

### 2. **firecrawl-mcp** (Mendable AI)
**Status:** ✅ Working
**Kapabilitas:**
- `firecrawl_scrape` - Scrape web content
- `firecrawl_search` - Search web
- `firecrawl_map` - Map website URLs

**Tested:** ✅ Successfully scraped cardarc.vercel.app
**Limitation:** Hanya dapat HTML rendered, tidak bisa inspect:
- JavaScript runtime variables
- Environment variables
- Contract addresses loaded in memory
- Network requests/transactions

**Useful For:**
- Check if site is up
- Verify visual elements
- Check static content
- NOT useful for debugging contract addresses

---

### 3. **context7-mcp** (Upstash)
**Status:** ✅ Available
**Kapabilitas:**
- `resolve-library-id` - Find library documentation
- `query-docs` - Query library docs

**Useful For:**
- Check documentation for libraries (Viem, Wagmi, etc.)
- NOT useful for debugging live app

---

### 4. **conversational-api-debugger**
**Status:** ✅ Available
**Kapabilitas:**
- API debugging workflow

**Useful For:**
- Backend API debugging
- NOT useful for smart contract/frontend issues

---

## ❌ MCP YANG DIBUTUHKAN (KURANG):

### 1. **Web3/Blockchain MCP** ⭐⭐⭐ (CRITICAL)
**Why:** Untuk interact dengan blockchain secara langsung

**Kapabilitas yang Dibutuhkan:**
```typescript
- readContract(address, abi, functionName, args)
  → Check contract state langsung
  → Verify tokenIds without frontend
  
- getTransaction(txHash)
  → Inspect transaction details
  → Check which contract was called
  
- getBlockNumber()
- getBalance(address)
- simulateTransaction()
```

**Use Case:**
```javascript
// Direct contract query (bypass frontend)
const tokenId = await readContract({
  address: '0x37D4259...',
  abi: ARC_CARDS_ABI,
  functionName: 'cardToTokenId',
  args: ['pkm-umbreon-vmax-001']
})
console.log(tokenId) // Should be 1, 2, 3... not 0
```

**Recommended MCP:**
- `@ethereum/web3-mcp` (if exists)
- `viem-mcp` (if exists)
- Custom MCP using Viem/Ethers

---

### 2. **Vercel MCP** ⭐⭐⭐ (CRITICAL)
**Why:** Untuk manage Vercel deployments & env vars

**Kapabilitas yang Dibutuhkan:**
```typescript
- listEnvVars(projectId)
  → Check current env vars
  
- updateEnvVar(key, value, environment)
  → Update contract addresses directly
  
- redeployProject(projectId)
  → Trigger redeploy programmatically
  
- getDeploymentStatus(deploymentId)
  → Check if deployment finished
```

**Use Case:**
```javascript
// Check current env vars
const vars = await listEnvVars('cardarc')
console.log(vars.VITE_CONTRACT_ADDRESS)
// If wrong, update it:
await updateEnvVar('VITE_CONTRACT_ADDRESS', '0x37D4259...', 'production')
await redeployProject('cardarc')
```

**Recommended MCP:**
- `@vercel/vercel-mcp` (if exists)
- Custom MCP using Vercel API

---

### 3. **RPC Provider MCP** ⭐⭐ (IMPORTANT)
**Why:** Untuk query blockchain via RPC

**Kapabilitas yang Dibutuhkan:**
```typescript
- eth_call(to, data)
  → Direct contract calls
  
- eth_getLogs(filter)
  → Get contract events
  
- eth_getTransactionReceipt(hash)
  → Verify transaction success
```

**Use Case:**
```javascript
// Check if transaction actually minted cards
const receipt = await eth_getTransactionReceipt('0x0d450e4f...')
const logs = receipt.logs.filter(log => 
  log.topics[0] === CardMintedEventSignature
)
console.log('Cards minted:', logs.length) // Should be 10
```

---

### 4. **Database MCP (Supabase)** ⭐ (NICE TO HAVE)
**Why:** Check database state

**Kapabilitas:**
```typescript
- query(sql)
  → Check nft_metadata table
  
- insert(table, data)
- update(table, data, filter)
```

**Use Case:**
```javascript
// Check if NFTs were saved to DB
const nfts = await query(
  'SELECT * FROM nft_metadata WHERE owner = $1',
  [userAddress]
)
console.log('NFTs in DB:', nfts.length)
```

---

## 🎯 RECOMMENDED ACTION PLAN:

### Immediate (With Current MCPs):

1. **Start Browser Connector** ⚡
   ```bash
   # User needs to run this
   npx @agentdeskai/browser-tools-mcp
   ```
   Then we can:
   - `getNetworkLogs()` → See which contract called
   - `getConsoleErrors()` → See exact errors
   - `takeScreenshot()` → Visual verification

2. **Manual Verification** (User Task)
   ```javascript
   // In browser console:
   console.log(import.meta.env.VITE_CONTRACT_ADDRESS)
   // Should be 0x37D4259... not 0x8757...
   ```

### Long-term (Install New MCPs):

1. **Install Web3 MCP** ⭐⭐⭐
   ```bash
   npm install -g @ethereum/web3-mcp  # (if exists)
   # Or create custom MCP with Viem
   ```

2. **Install Vercel MCP** ⭐⭐⭐
   ```bash
   npm install -g @vercel/vercel-mcp  # (if exists)
   # Or use Vercel CLI directly
   ```

3. **Create Custom Blockchain MCP** ⭐⭐
   ```typescript
   // Arc Testnet RPC MCP
   // Endpoints: https://rpc.dev.arc.build
   // Functions: readContract, getTransaction, etc.
   ```

---

## 🔧 WORKAROUND (Tanpa MCP Tambahan):

Karena kita tidak punya Web3/Vercel MCP, kita bisa:

### Option 1: Direct RPC Call (via Terminal)
```bash
# Check contract state via curl
curl -X POST https://rpc.dev.arc.build \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": "0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A",
      "data": "0x..."
    }, "latest"],
    "id": 1
  }'
```

### Option 2: Vercel CLI (via Terminal)
```bash
# Check env vars
vercel env ls

# Update env var
vercel env add VITE_CONTRACT_ADDRESS production
# Enter: 0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A

# Redeploy
vercel --prod
```

### Option 3: Create Test Script
```javascript
// test-contract-state.js
import { createPublicClient, http } from 'viem'
import { arcTestnet } from './chainConfig.js'

const client = createPublicClient({
  chain: arcTestnet,
  transport: http('https://rpc.dev.arc.build')
})

const tokenId = await client.readContract({
  address: '0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A',
  abi: ARC_CARDS_ABI,
  functionName: 'cardToTokenId',
  args: ['pkm-umbreon-vmax-001']
})

console.log('Token ID:', tokenId) // Should be 1, not 0
```

---

## 📊 SUMMARY:

**Current MCP Capabilities:**
- ✅ Scrape web content (Firecrawl)
- ⚠️ Browser debugging (needs connector running)
- ❌ Blockchain interaction (MISSING)
- ❌ Vercel management (MISSING)

**What We Need Most:**
1. **Web3 MCP** (query contracts directly)
2. **Vercel MCP** (manage deployments)
3. **Browser Tools** (start connector!)

**Current Workaround:**
- Use terminal commands (curl, vercel CLI)
- Write test scripts (Viem/Ethers)
- Manual browser inspection (F12)

---

## 🚀 NEXT STEPS:

1. **User starts browser connector:**
   ```bash
   npx @agentdeskai/browser-tools-mcp
   ```

2. **Then I can use browser-tools to:**
   - Get network logs (see which contract called)
   - Get console errors (exact error messages)
   - Take screenshots (visual verification)

3. **Or User manually checks:**
   ```javascript
   // Browser console
   console.log(import.meta.env.VITE_CONTRACT_ADDRESS)
   // Expected: 0x37D4259...
   // If wrong: Update Vercel env vars + redeploy
   ```

4. **Install recommended MCPs** (for future debugging)