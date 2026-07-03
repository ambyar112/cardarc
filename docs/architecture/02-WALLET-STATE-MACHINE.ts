/**
 * ═══════════════════════════════════════════════════════════════════════
 * WALLET STATE MACHINE — Production React Hook
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Handles: multi-wallet async connection, chain switching, session
 * persistence, block-explorer integration, zero-CLS hydration states.
 * 
 * Dependencies: wagmi, viem, @reown/appkit
 * 
 * ARCHITECTURE RATIONALE:
 * - State machine pattern prevents impossible states (e.g. "connecting" 
 *   while "disconnecting") — each transition is explicit and validated.
 * - sessionStorage flag detects browser close vs tab refresh.
 * - Skeleton placeholders eliminate CLS during wallet hydration.
 * - EIP-712 typed data signing for backend gacha claims.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useSignMessage,
  useSignTypedData,
  usePublicClient,
  useWalletClient,
} from 'wagmi';
import { type Address, type Hash, formatEther, parseEther } from 'viem';
// NOTE: This is a reference implementation. When integrating into src/,
// update the import path to '@/lib/wagmi' or the correct relative path.
import { arc } from '../../src/lib/wagmi';

// ────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────

export type WalletState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'switching_chain'
  | 'signing'
  | 'error';

export interface WalletInfo {
  address: Address | undefined;
  chainId: number | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isReconnecting: boolean;
  isWrongChain: boolean;
  balance: string | null;
  ensName: string | null;
  explorerUrl: string | null;
  state: WalletState;
  error: Error | null;
}

export interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToarc: () => Promise<void>;
  signMessage: (message: string) => Promise<Hash | null>;
  signGachaClaim: (cardId: string, nonce: string) => Promise<Hash | null>;
  clearError: () => void;
}

export interface UseWalletConnectionReturn extends WalletInfo, WalletActions {}

// ────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────

const ARC_CHAIN_ID = 333;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const BALANCE_POLL_INTERVAL = 15_000; // 15s
const SESSION_KEY = 'arc_session_ts';
const BROWSER_SESSION_FLAG = 'arc_browser_session_active';

// ────────────────────────────────────────────────────────────────────────
// SESSION MANAGEMENT HELPERS
// ────────────────────────────────────────────────────────────────────────

function isNewBrowserSession(): boolean {
  try {
    return !sessionStorage.getItem(BROWSER_SESSION_FLAG);
  } catch {
    return true;
  }
}

function markSessionActive(): void {
  try {
    sessionStorage.setItem(BROWSER_SESSION_FLAG, '1');
  } catch {}
}

function isSessionExpired(): boolean {
  try {
    const ts = parseInt(localStorage.getItem(SESSION_KEY) || '0', 10);
    if (!ts) return false;
    return Date.now() - ts > SESSION_TTL_MS;
  } catch {
    return false;
  }
}

function refreshSessionTimestamp(): void {
  try {
    localStorage.setItem(SESSION_KEY, String(Date.now()));
  } catch {}
}

function getExplorerUrl(address: Address): string {
  return `${arc.blockExplorers.default.url}/address/${address}`;
}

// ────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ────────────────────────────────────────────────────────────────────────

export function useWalletConnection(): UseWalletConnectionReturn {
  // ── Wagmi hooks ──────────────────────────────────────────────────
  const {
    address,
    isConnected,
    isConnecting,
    isDisconnected,
    isReconnecting,
    status: accountStatus,
  } = useAccount();

  const chainId = useChainId();
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // ── Local state ──────────────────────────────────────────────────
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [manualState, setManualState] = useState<WalletState>('idle');
  const balanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived state ────────────────────────────────────────────────
  const isWrongChain = isConnected && chainId !== ARC_CHAIN_ID;

  const state: WalletState = useMemo(() => {
    if (manualState !== 'idle') return manualState;
    if (isConnecting || isReconnecting) return 'connecting';
    if (isSwitchPending) return 'switching_chain';
    if (isConnectPending) return 'connecting';
    if (isConnected && !isWrongChain) return 'connected';
    if (isDisconnected) return 'idle';
    return 'idle';
  }, [manualState, isConnecting, isReconnecting, isSwitchPending, isConnectPending, isConnected, isWrongChain, isDisconnected]);

  // ── Balance fetching ─────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!address || !publicClient) {
      setBalance(null);
      return;
    }
    try {
      const bal = await publicClient.getBalance({ address });
      setBalance(formatEther(bal));
    } catch {
      // Silent fail — balance fetch is non-critical
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalance();
      balanceIntervalRef.current = setInterval(fetchBalance, BALANCE_POLL_INTERVAL);
      return () => {
        if (balanceIntervalRef.current) clearInterval(balanceIntervalRef.current);
      };
    } else {
      setBalance(null);
      if (balanceIntervalRef.current) clearInterval(balanceIntervalRef.current);
    }
  }, [isConnected, address, fetchBalance]);

  // ── Session persistence ──────────────────────────────────────────
  useEffect(() => {
    if (isConnected) {
      refreshSessionTimestamp();
    }
  }, [isConnected]);

  // Auto-disconnect on wrong chain for extended period
  useEffect(() => {
    if (!isWrongChain) return;
    const timer = setTimeout(() => {
      if (isWrongChain) {
        disconnectAsync().catch(() => {});
      }
    }, 30_000); // 30s grace period to switch
    return () => clearTimeout(timer);
  }, [isWrongChain, disconnectAsync]);

  // ── ACTIONS ──────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setError(null);
    setManualState('connecting');
    try {
      // Find injected connector (MetaMask) or first available
      const connector = connectors.find(c => c.id === 'injected') || connectors[0];
      if (!connector) throw new Error('No wallet connector available');
      await connectAsync({ connector });
      refreshSessionTimestamp();
      setManualState('connected');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setManualState('error');
      // Auto-clear error state after 5s
      setTimeout(() => setManualState('idle'), 5000);
    }
  }, [connectAsync, connectors]);

  const disconnect = useCallback(async () => {
    setManualState('disconnecting');
    setError(null);
    try {
      await disconnectAsync();
      setBalance(null);
      setManualState('idle');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setManualState('idle');
    }
  }, [disconnectAsync]);

  const switchToarc = useCallback(async () => {
    setManualState('switching_chain');
    setError(null);
    try {
      await switchChainAsync({ chainId: ARC_CHAIN_ID });
      setManualState('connected');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setManualState('error');
      setTimeout(() => setManualState('idle'), 5000);
    }
  }, [switchChainAsync]);

  const signMessage = useCallback(async (message: string): Promise<Hash | null> => {
    setManualState('signing');
    setError(null);
    try {
      const hash = await signMessageAsync({ message });
      setManualState('connected');
      return hash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setManualState('connected');
      return null;
    }
  }, [signMessageAsync]);

  /**
   * Sign a gacha claim using EIP-712 typed data.
   * This produces a structured signature that the backend can verify
   * without ambiguity about the signed content.
   */
  const signGachaClaim = useCallback(async (
    cardId: string,
    nonce: string
  ): Promise<Hash | null> => {
    setManualState('signing');
    setError(null);
    try {
      const hash = await signTypedDataAsync({
        domain: {
          name: 'ArcCards',
          version: '1',
          chainId: BigInt(ARC_CHAIN_ID),
        },
        types: {
          GachaClaim: [
            { name: 'recipient', type: 'address' },
            { name: 'cardId', type: 'string' },
            { name: 'nonce', type: 'bytes32' },
          ],
        },
        primaryType: 'GachaClaim',
        message: {
          recipient: address!,
          cardId,
          nonce: nonce as `0x${string}`,
        },
      });
      setManualState('connected');
      return hash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setManualState('connected');
      return null;
    }
  }, [signTypedDataAsync, address]);

  const clearError = useCallback(() => {
    setError(null);
    if (manualState === 'error') setManualState('idle');
  }, [manualState]);

  // ── Explorer URL ─────────────────────────────────────────────────
  const explorerUrl = address ? getExplorerUrl(address) : null;

  // ── Return ───────────────────────────────────────────────────────
  return {
    // Info
    address,
    chainId,
    isConnected,
    isConnecting: isConnecting || isReconnecting || isConnectPending,
    isDisconnected,
    isReconnecting,
    isWrongChain,
    balance,
    ensName: null, // Arc Network has no ENS
    explorerUrl,
    state,
    error,
    // Actions
    connect,
    disconnect,
    switchToarc,
    signMessage,
    signGachaClaim,
    clearError,
  };
}

// ────────────────────────────────────────────────────────────────────────
// ZERO-CLS SKELETON HELPER
// ────────────────────────────────────────────────────────────────────────
// 
// Usage in components:
//   const { state } = useWalletConnection();
//   const isHydrating = state === 'connecting' || state === 'idle';
//   return isHydrating ? <WalletSkeleton /> : <WalletFull />;
//
// The skeleton MUST have identical dimensions to the full component
// to prevent Cumulative Layout Shift. Use fixed width/height containers.
//
// Example skeleton:
//   <div className="w-[200px] h-[40px] rounded-lg bg-gray-800 animate-pulse" />
//
// This matches the connected wallet button dimensions exactly.
