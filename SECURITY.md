# ArcCards — Security Audit & Fix Log

Dokumen ini mencatat semua celah keamanan yang ditemukan dan diperbaiki pada proyek ArcCards.

---

## ✅ FIXES YANG SUDAH DITERAPKAN

### CRITICAL

| ID | Komponen | Masalah | Fix |
|---|---|---|---|
| VULN-01 | `.env.local` | Vercel OIDC token terekspos | File dihapus. Token harus di-rotate di Vercel dashboard |
| VULN-02 | `ArcCards.sol` | `selfMint` + `selfMintBatch` permissionless — siapapun bisa mint gratis | Dihapus. Diganti `claimMint` dengan backend signature verification |
| VULN-03 | Supabase RLS | `with check (true)` — tidak ada ownership validation | RLS policies diperketat dengan wallet normalization + faucet rate limit di DB |
| FRONT-01 | `ListModal.jsx` | Import `selfMintCard` yang tidak ada — runtime crash | Diganti dengan `mintCardNFT` dari `mint.js` |
| FRONT-02 | `Gacha.jsx` | Tidak ada race condition lock — double summon | Ditambahkan `summoning` state lock + `finally` cleanup |

### HIGH

| ID | Komponen | Masalah | Fix |
|---|---|---|---|
| SC-02 | `ArcMarketplace.sol` | `cardId` tidak diverifikasi vs `tokenId` — metadata spoofing | Ditambahkan `require(keccak256(onChainCardId) == keccak256(cardId))` |
| VULN-04 | `supabase.js` | Faucet rate limit hanya di client-side | Dipindah ke DB-level RLS policy `faucet_insert_cooldown` |
| VULN-07 | `Profile.jsx` | Username tanpa sanitasi — stored XSS risk | Ditambahkan allowlist regex `/^[a-zA-Z0-9_\-]{1,20}$/` + DB constraint |
| VULN-08 | `supabase.js` | Marketplace metadata fully user-controlled | Ditambahkan `validateTier()`, `validateImgUrl()`, `sanitizeText()` |
| API-01 | Semua lib files | Third-party API data tidak disanitasi | Ditambahkan `sanitize()` di semua mapper |
| API-04 | `onepiece.js` | Unsafe Markdown URL parsing | Diganti dengan `safeImg()` yang proper URL parser |

### MEDIUM

| ID | Komponen | Masalah | Fix |
|---|---|---|---|
| SC-03 | `ArcMarketplace.sol` | `withdrawETH` tidak emit event | Ditambahkan `emit EmergencyWithdraw(owner(), amount)` |
| VULN-09 | `vercel.json` | CSP terlalu longgar, domain CDN hilang | Ditambahkan HSTS, domain whitelist lengkap |
| VULN-10 | `Marketplace.jsx` | `markListingCancelled` tidak butuh auth | Fixed — on-chain cancel sudah enforce auth, Supabase sync diperbaiki |
| VULN-12 | `wagmi.js` | URL metadata masih `localhost:5173` | Diganti dengan `import.meta.env.VITE_APP_URL` |
| FRONT-04 | `Settings.jsx` | Contract address hardcoded salah sebagai fallback | Dihapus fallback, pakai env var only |
| FRONT-03 | `Marketplace.jsx` | Supabase merge pakai UUID bukan on_chain_listing_id | Fixed — merge sekarang via `on_chain_listing_id` |
| API-02 | Cache localStorage | Data poisoning via localStorage | Semua data dari third-party sekarang disanitasi sebelum di-cache |

---

## ⚠️ DEPENDENCY VULNERABILITIES (CANNOT AUTO-FIX)

39 vulnerabilities tersisa di `node_modules` — semua berasal dari upstream wagmi/reown/walletconnect ecosystem dan **tidak bisa difix tanpa breaking changes** ke wagmi v3+.

| Package | Severity | CVE | Status |
|---|---|---|---|
| `esbuild ≤0.28.0` | HIGH | GHSA-67mh-4wv8-2f99 | Dev-only (tidak affect production build) |
| `ws 8.0.0-8.20.0` | HIGH | GHSA-3h5v-q93c-6h6q | Upstream di viem/ethers — monitor untuk update |
| `@coinbase/wallet-sdk` | HIGH | GHSA-8rgj-285w-qcq4 | Upstream di wagmi connectors |
| `@stablelib/ed25519` | MODERATE | GHSA-x3ff-w252-2g7j | Upstream di WalletConnect relay-auth |
| `@metamask/sdk` | MODERATE | GHSA-qj3p-xc97-xw74 | Upstream di wagmi connectors |

**Mitigasi:** Semua vuln ini ada di wallet connection layer (WalletConnect/MetaMask/Coinbase SDK). Karena ini testnet app dan tidak handle private keys secara langsung, risk-nya terkontrol. Monitor upstream releases secara berkala.

---

## 🔄 ACTION ITEMS YANG MASIH PERLU DILAKUKAN MANUAL

### WAJIB sebelum production:

1. **Rotate Vercel OIDC Token** — pergi ke [vercel.com/dashboard](https://vercel.com/dashboard) → Settings → Tokens → Delete token yang terekspos
2. **Redeploy Smart Contracts** — kedua contract harus di-redeploy setelah perubahan:
   ```bash
   npx hardhat run scripts/deploy.cjs --network arc
   ```
   Lalu update `VITE_CONTRACT_ADDRESS` dan `VITE_MARKETPLACE_ADDRESS` di `.env`
3. **Jalankan SQL schema baru** di Supabase SQL Editor — `supabase_schema.sql` berisi RLS policies baru
4. **Set `VITE_APP_URL`** di Vercel Environment Variables → `https://cardarc.vercel.app`

### Recommended (security hardening lanjutan):

5. **Implementasi SIWE** (Sign-In With Ethereum) untuk proper wallet-based auth di Supabase
6. **Upgrade vite** ke v6+ setelah test compatibility: `npm install vite@latest --legacy-peer-deps`
7. **Tambahkan rate limiting** di Vercel Edge Middleware untuk endpoint Supabase

---

## 📋 CHECKLIST STATUS

```
[✅] Smart contract selfMint removed
[✅] Smart contract cardId verification added
[✅] Smart contract event logging added
[✅] Supabase RLS policies hardened
[✅] Faucet rate limit moved to DB level
[✅] Username sanitization + allowlist
[✅] All third-party API data sanitized
[✅] Image URL validation (HTTPS + domain allowlist)
[✅] Race condition lock on gacha summon
[✅] Wallet address normalization throughout
[✅] Marketplace metadata validation
[✅] CSP headers updated + HSTS added
[✅] WalletConnect metadata URL fixed
[✅] Contract fallback address removed
[✅] Marketplace on_chain_listing_id sync fixed
[✅] ABI updated (selfMint entries removed)
[✅] .env.local deleted (contained exposed token)
[✅] Smart contracts redeployed
[✅]   ArcCards:       0x00B4add7c37E70690EEE4d14C222e50B926cd2E5
[✅]   ArcMarketplace: 0x2Cee9C1AAd5626C63630aF47641157082F982BbC
[✅] Supabase schema migration complete
[⚠️] Vercel token rotation PENDING
[⚠️] Upstream dependency vulns — monitor upstream
```
