# 🚀 Panduan Lengkap Deploy Arc Network - CardArc dApp

## Status Deploy Contract

| Item | Value |
|------|-------|
| Network | Arc Testnet (chainId: 5042002) |
| ArcCards Contract | `0x8757D77aaCF0EEFcf18e9e834557de53A216e4da` |
| Marketplace Contract | `0x7B22FADff81836083DCa60EbE006e518D0011D70` |
| Deployer | `0x7778b915e86fBf35d9E1cB7fD5d3fD8A6c0bEBFB` |
| ArcScan Cards | https://testnet.arcscan.app/address/0x8757D77aaCF0EEFcf18e9e834557de53A216e4da |
| ArcScan Market | https://testnet.arcscan.app/address/0x7B22FADff81836083DCa60EbE006e518D0011D70 |

---

## STEP 1: Update Vercel Environment Variables

### 1a. Buka Vercel Dashboard

1. Login ke https://vercel.com
2. Pilih project **cardarc**
3. Klik **Settings** (tab di atas)
4. Klik **Environment Variables** (menu kiri)

### 1b. Update 2 Environment Variables Ini

Ganti value lama dengan yang baru:

```
VITE_CONTRACT_ADDRESS = 0x8757D77aaCF0EEFcf18e9e834557de53A216e4da
VITE_MARKETPLACE_ADDRESS = 0x7B22FADff81836083DCa60EbE006e518D0011D70
```

**Cara update:**
1. Cari baris `VITE_CONTRACT_ADDRESS` → klik icon edit (✏️)
2. Ganti value lama → paste `0x8757D77aaCF0EEFcf18e9e834557de53A216e4da`
3. Klik **Save**
4. Cari baris `VITE_MARKETPLACE_ADDRESS` → klik icon edit (✏️)
5. Ganti value lama → paste `0x7B22FADff81836083DCa60EbE006e518D0011D70`
6. Klik **Save**

### 1c. Pastikan Environment Variables Lengkap

Pastikan SEMUA variabel ini ada di Vercel:

| Variable Name | Value |
|--------------|-------|
| `VITE_REOWN_PROJECT_ID` | `e1c9139d112640c3ae74aaedf023d33b` |
| `VITE_SUPABASE_URL` | `https://xswquwhtulshrvwkyjqu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (isi dari .env) |
| `VITE_CONTRACT_ADDRESS` | `0x8757D77aaCF0EEFcf18e9e834557de53A216e4da` |
| `VITE_MARKETPLACE_ADDRESS` | `0x7B22FADff81836083DCa60EbE006e518D0011D70` |
| `VITE_APP_URL` | `https://cardarc.vercel.app` |

> ⚠️ JANGAN masukkan `DEPLOYER_PRIVATE_KEY` ke Vercel! Itu hanya untuk local deploy.

### 1d. Trigger Redeploy

Setelah update env vars:
1. Klik tab **Deployments** di atas
2. Klik titik tiga (⋮) di deployment terbaru
3. Klik **Redeploy**
4. Tunggu sampai status **Ready** (~1-2 menit)

---

## STEP 2: Verifikasi Reown AppKit (OPSIONAL - Mungkin Tidak Perlu)

> ⚠️ **CATATAN:** Arc Testnet mungkin sudah built-in di Reown/WalletConnect. Jika wallet sudah bisa connect ke Arc Testnet tanpa error, skip step ini.

### 2a. Buka Reown Cloud Dashboard

1. Login ke https://cloud.reown.com
2. Di halaman utama, klik project kamu (nama: sesuai VITE_REOWN_PROJECT_ID)
3. Kamu akan masuk ke **Project Dashboard**

### 2b. Cek Network Configuration (Jika Ada)

**Tempat cek Explorer/Networks:**
- Di sidebar kiri, cari menu **"Explorer"** ATAU **"Networks"** ATAU **"Configuration"**
- Jika tidak ada menu tersebut, berarti Reown sudah auto-support semua EVM chains termasuk Arc Testnet
- **Kamu TIDAK perlu add chain secara manual** - Reown AppKit v2+ sudah support custom chains via wagmi config

### 2c. Yang Penting: wagmi.js Sudah Benar

File `src/lib/wagmi.js` sudah dikonfigurasi dengan Arc Testnet:
```javascript
chains: [arcTestnet], // chainId 5042002
```

Ini sudah cukup. Reown AppKit akan otomatis detect chain dari wagmi config.

---

## STEP 3: Tambahkan Arc Testnet ke MetaMask

User perlu menambahkan network ini di wallet mereka:

| Field | Value |
|-------|-------|
| Network Name | Arc Testnet |
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Currency Symbol | ETH |
| Block Explorer URL | `https://testnet.arcscan.app` |

Atau gunakan tombol "Switch to Arc Testnet" di app (sudah built-in).

---

## STEP 4: Verifikasi Live Site

Setelah Vercel selesai redeploy:

1. Buka https://cardarc.vercel.app
2. Connect wallet
3. Pastikan network menunjukkan **Arc Testnet** (bukan Base Sepolia)
4. Cek halaman Settings → pastikan contract address = `0x8757...e4da`
5. Test mint card di halaman Gacha
6. Test marketplace listing

---

## Troubleshooting

### Wallet masih menunjukkan Base Sepolia?
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R)
- Pastikan Vercel sudah selesai redeploy (status "Ready")

### "Chain not supported" error?
- Tambahkan Arc Testnet di Reown Cloud (Step 2)
- Tambahkan Arc Testnet di MetaMask (Step 3)

### Contract interaction gagal?
- Cek contract address di ArcScan: https://testnet.arcscan.app
- Pastikan user punya ETH di Arc Testnet
- Cek console browser untuk error detail

---

## Quick Reference Commands

```bash
# Compile contracts
npx hardhat compile

# Deploy ke Arc Testnet
npx hardhat run scripts/deployBase.cjs --network arc

# Cek balance deployer
npx hardhat console --network arc
> (await ethers.provider.getBalance("0x7778b915e86fBf35d9E1cB7fD5d3fD8A6c0bEBFB")).toString()

# Local dev
npm run dev