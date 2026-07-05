/**
 * ArcCards Mint Debug Tool
 * Run this in browser console to diagnose mint failures
 * 
 * Usage:
 * 1. Open https://cardarc.vercel.app
 * 2. Open DevTools (F12)
 * 3. Go to Console tab
 * 4. Copy-paste this entire script
 * 5. Try to open a pack/mint
 * 6. Debug output will show exactly where it fails
 */

(function() {
  console.log('%c🔍 ArcCards Mint Debugger Initialized', 'color:#16e6ff;font-size:16px;font-weight:bold;');
  
  // Expected contract addresses
  const EXPECTED = {
    cards: '0x37D4259aae3F7B79BFc414A98A58ed050Ca3Ed3A',
    marketplace: '0xD85E15A66C9F2f6a0E4c6C7472a6C0Fe58845438'
  };
  
  const OLD = {
    cards: '0x8757D77aaCF0EEFcf18e9e834557de53A216e4da',
    marketplace: '0x7B22FADff81836083DCa60EbE006e518D0011D70'
  };
  
  // Step 1: Check environment variables
  console.log('\n%c━━━ STEP 1: ENV VARS CHECK ━━━', 'color:#f5c84c;font-weight:bold');
  
  try {
    const viteCardAddr = import.meta.env?.VITE_CONTRACT_ADDRESS;
    const viteMarketAddr = import.meta.env?.VITE_MARKETPLACE_ADDRESS;
    
    console.log('VITE_CONTRACT_ADDRESS:', viteCardAddr);
    console.log('VITE_MARKETPLACE_ADDRESS:', viteMarketAddr);
    
    if (viteCardAddr === EXPECTED.cards) {
      console.log('%c✅ Cards address CORRECT (NEW)', 'color:#4ade80');
    } else if (viteCardAddr === OLD.cards) {
      console.log('%c❌ Cards address WRONG (OLD) - Hard refresh needed!', 'color:#ff6b6b;font-weight:bold');
    } else {
      console.log('%c⚠️  Cards address UNKNOWN:', viteCardAddr, 'color:#f5c84c');
    }
    
    if (viteMarketAddr === EXPECTED.marketplace) {
      console.log('%c✅ Marketplace address CORRECT (NEW)', 'color:#4ade80');
    } else if (viteMarketAddr === OLD.marketplace) {
      console.log('%c❌ Marketplace address WRONG (OLD)', 'color:#ff6b6b');
    } else {
      console.log('%c⚠️  Marketplace address UNKNOWN:', viteMarketAddr, 'color:#f5c84c');
    }
  } catch (e) {
    console.log('%c❌ Cannot read env vars (might be production build)', 'color:#ff6b6b');
  }
  
  // Step 2: Intercept writeContract calls
  console.log('\n%c━━━ STEP 2: MONITORING TRANSACTIONS ━━━', 'color:#f5c84c;font-weight:bold');
  console.log('Waiting for mint transaction...');
  console.log('(Open a pack now and I will capture the details)');
  
  // Hook into console.log to capture mint logs
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = function(...args) {
    // Capture mint transaction hash
    if (args[0] && typeof args[0] === 'string') {
      if (args[0].includes('Batch mint tx:')) {
        console.log('\n%c━━━ TRANSACTION DETECTED ━━━', 'color:#16e6ff;font-weight:bold');
        originalLog.apply(console, args);
        
        const txHash = args[1];
        if (txHash) {
          const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`;
          originalLog('%cExplorer:', 'color:#f5c84c', explorerUrl);
          originalLog('%c📋 Click to check transaction details', 'color:#9aa3b2');
        }
      } else if (args[0].includes('Batch minted tokenIds:')) {
        originalLog.apply(console, args);
        
        const tokenIds = args[1];
        if (Array.isArray(tokenIds)) {
          const allZeros = tokenIds.every(id => id === 0);
          if (allZeros) {
            console.log('\n%c⚠️  ALL TOKENIDS ARE 0!', 'color:#ff6b6b;font-size:14px;font-weight:bold');
            console.log('%cThis means:', 'color:#f5c84c');
            console.log('  1. Frontend is calling OLD contract, OR');
            console.log('  2. Event parsing failed, OR');
            console.log('  3. cardToTokenId mapping read failed');
            console.log('\n%cSolution:', 'color:#16e6ff');
            console.log('  1. Hard refresh (Ctrl+Shift+R)');
            console.log('  2. Check contract address (should be 0x37D4...)');
            console.log('  3. If still OLD, manual Vercel redeploy needed');
          } else {
            console.log('%c✅ TokenIds look correct!', 'color:#4ade80;font-weight:bold');
          }
        }
      }
    }
    originalLog.apply(console, args);
  };
  
  console.error = function(...args) {
    if (args[0] && typeof args[0] === 'string') {
      if (args[0].includes('mint') || args[0].includes('Mint')) {
        console.log('\n%c━━━ ERROR DETECTED ━━━', 'color:#ff6b6b;font-weight:bold');
        originalError.apply(console, args);
        
        // Try to extract useful info
        if (args[0].includes('UnauthorizedMinter')) {
          console.log('\n%c⚠️  ERROR: UnauthorizedMinter', 'color:#ff6b6b;font-size:14px');
          console.log('%cThis means:', 'color:#f5c84c');
          console.log('  Frontend is calling OLD contract (0x8757...)');
          console.log('  OLD contract still has onlyMinter restriction');
          console.log('\n%cSolution:', 'color:#16e6ff');
          console.log('  1. Hard refresh browser (Ctrl+Shift+R)');
          console.log('  2. Verify env vars in Vercel dashboard');
          console.log('  3. Manual redeploy if needed');
        }
      }
    }
    originalError.apply(console, args);
  };
  
  // Step 3: Check network requests
  console.log('\n%c━━━ STEP 3: NETWORK MONITORING ━━━', 'color:#f5c84c;font-weight:bold');
  console.log('Open DevTools Network tab to see actual contract calls');
  console.log('Filter by: "chain"');
  console.log('Look for RPC calls and check "to" address');
  
  // Summary
  console.log('\n%c━━━ DEBUG TOOL READY ━━━', 'color:#4ade80;font-weight:bold');
  console.log('Now try to open a pack/mint a card.');
  console.log('I will capture and analyze the transaction.');
  console.log('');
  console.log('%cExpected flow:', 'color:#f5c84c');
  console.log('1. Transaction sent to contract');
  console.log('2. Transaction hash logged');
  console.log('3. TokenIds extracted from events');
  console.log('4. Success! (tokenIds = [1, 2, 3, ...])');
  console.log('');
  console.log('%cIf it fails, error details will show above ↑', 'color:#9aa3b2');
})();