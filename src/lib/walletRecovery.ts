/**
 * ═══════════════════════════════════════════════════════════════════════
 * WALLET RECOVERY UTILITY
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Provides utilities for wallet reconnection and recovery after
 * unexpected disconnections (system sleep, reboot, network issues)
 */

// ────────────────────────────────────────────────────────────────────────
// WALLET STATE CHECK
// ────────────────────────────────────────────────────────────────────────

export interface WalletRecoveryStatus {
  hasStoredSession: boolean;
  sessionValid: boolean;
  sessionAge: number;
  walletConnectKeys: string[];
  appKitKeys: string[];
  wagmiKeys: string[];
}

export function checkWalletRecoveryStatus(): WalletRecoveryStatus {
  try {
    const arcccSession = localStorage.getItem('arccc_wallet_session');
    const arcSessionTs = localStorage.getItem('arc_session_ts');
    const now = Date.now();

    let sessionAge = 0;
    let sessionValid = false;

    if (arcccSession) {
      try {
        const session = JSON.parse(arcccSession);
        sessionAge = now - session.timestamp;
        // Session valid if less than 7 days old
        sessionValid = sessionAge < 7 * 24 * 60 * 60 * 1000;
      } catch {
        // Invalid JSON
      }
    }

    // Collect all wallet-related keys
    const walletConnectKeys = Object.keys(localStorage).filter(k => k.startsWith('wc@'));
    const appKitKeys = Object.keys(localStorage).filter(k => k.startsWith('@appkit'));
    const wagmiKeys = Object.keys(localStorage).filter(k => k.startsWith('wagmi') || k.includes('walletconnect'));

    return {
      hasStoredSession: !!arcccSession,
      sessionValid,
      sessionAge,
      walletConnectKeys,
      appKitKeys,
      wagmiKeys,
    };
  } catch (err) {
    console.error('[WalletRecovery] Status check failed:', err);
    return {
      hasStoredSession: false,
      sessionValid: false,
      sessionAge: 0,
      walletConnectKeys: [],
      appKitKeys: [],
      wagmiKeys: [],
    };
  }
}

// ────────────────────────────────────────────────────────────────────────
// FORCE CLEAR & RECONNECT
// ────────────────────────────────────────────────────────────────────────

export function forceWalletRecovery(): void {
  try {
    console.log('[WalletRecovery] Initiating forced wallet recovery...');

    // Clear old session data
    const keysToRemove = Object.keys(localStorage).filter(
      key =>
        key.startsWith('wc@') ||
        key.startsWith('@appkit') ||
        key.startsWith('W3M') ||
        key.startsWith('wagmi') ||
        key.includes('walletconnect')
    );

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[WalletRecovery] Cleared: ${key}`);
    });

    // Update session timestamp to current time to allow reconnection
    localStorage.setItem('arc_session_ts', String(Date.now()));

    console.log('[WalletRecovery] Session cleared. Reload page to reconnect.');
    
    // Optionally reload page
    // window.location.reload();
  } catch (err) {
    console.error('[WalletRecovery] Force recovery failed:', err);
  }
}

// ────────────────────────────────────────────────────────────────────────
// SAFE RECOVERY (Keep session, just clear connectors)
// ────────────────────────────────────────────────────────────────────────

export function safeWalletRecovery(): void {
  try {
    console.log('[WalletRecovery] Initiating safe wallet recovery...');

    // Only clear WalletConnect connector state, preserve session
    const keysToRemove = Object.keys(localStorage).filter(
      key =>
        key.startsWith('wc@') ||
        key.startsWith('@appkit')
    );

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[WalletRecovery] Cleared: ${key}`);
    });

    // Refresh timestamp
    localStorage.setItem('arc_session_ts', String(Date.now()));

    console.log('[WalletRecovery] Connector state cleared, session preserved.');
    
    // Reload to trigger reconnection
    setTimeout(() => window.location.reload(), 500);
  } catch (err) {
    console.error('[WalletRecovery] Safe recovery failed:', err);
  }
}

// ────────────────────────────────────────────────────────────────────────
// DEBUG: Log wallet state
// ────────────────────────────────────────────────────────────────────────

export function debugWalletState(): void {
  const status = checkWalletRecoveryStatus();
  
  console.group('[WalletRecovery] Current Wallet State');
  console.log('Has stored session:', status.hasStoredSession);
  console.log('Session valid:', status.sessionValid);
  console.log('Session age (ms):', status.sessionAge);
  console.log('Session age (hours):', Math.round(status.sessionAge / 1000 / 60 / 60));
  console.log('WalletConnect keys:', status.walletConnectKeys);
  console.log('AppKit keys:', status.appKitKeys);
  console.log('Wagmi keys:', status.wagmiKeys);
  
  // Check for stored session details
  const arcccSession = localStorage.getItem('arccc_wallet_session');
  if (arcccSession) {
    try {
      const session = JSON.parse(arcccSession);
      console.log('Stored wallet address:', session.address);
      console.log('Stored chain ID:', session.chainId);
    } catch {}
  }
  
  console.groupEnd();
}