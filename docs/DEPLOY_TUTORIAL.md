# 🚀 Tutorial Deploy ArcCards ke Vercel

## ✅ Commit Lokal Sudah Siap
```
f335289 fix: add rpc.walletconnect.org to CSP connect-src
4fa7971 fix: restore minting step in ListModal
```

---

## OPSI 1: Deploy via Vercel CLI (Paling Cepat — 2 Menit)

### Step 1: Install Vercel CLI
```powershell
npm install -g vercel
```

### Step 2: Login ke Vercel
```powershell
vercel login
```
Browser terbuka → klik login via GitHub/Email.

### Step 3: Deploy (dari folder project)
```powershell
cd c:\Users\Pongo\Downloads\arccc
vercel --prod
```

Jika diminta link ke project yang sudah ada, pilih project `arccc` atau `cardarc`.

### Step 4: Selesai! ✅
Vercel akan build & deploy otomatis. URL deploy muncul di terminal.

---

## OPSI 2: Deploy via GitHub + Vercel Dashboard (Auto-Deploy)

### Step 1: Buat Repository di GitHub
1. Buka https://github.com/new
2. Repository name: `arccc`
3. Visibility: **Private** (recommended)
4. JANGAN centang "Add a README" (repo sudah ada isinya)
5. Klik **Create repository**

### Step 2: Push Code ke GitHub
GitHub akan menampilkan perintah. Jalankan di terminal:
```powershell
cd c:\Users\Pongo\Downloads\arccc

# Tambahkan remote (ganti YOUR_USERNAME dengan username GitHub kamu)
git remote add origin https://github.com/YOUR_USERNAME/arccc.git

# Push
git push -u origin master
```

Jika diminta login, GitHub akan buka browser untuk auth.

### Step 3: Connect ke Vercel
1. Buka https://vercel.com/dashboard
2. Klik **"Add New..."** → **Project**
3. Cari repo `arccc` → klik **Import**
4. Settings (sudah ter-configure dari vercel.json):
   - Framework: **Vite** ✅
   - Build Command: `npm run build` ✅
   - Output Directory: `dist` ✅
   - Install Command: `npm install --legacy-peer-deps` ✅
5. Tambahkan **Environment Variables** (jika belum ada):
   ```
   VITE_REOWN_PROJECT_ID = e1c913963e340a4386526f8a4ccdb036
   VITE_ACTIVE_CHAIN = baseSepolia
   VITE_APP_URL = https://cardarc.vercel.app
   VITE_SUPABASE_URL = https://xswquwhtulshrvwkyjqu.supabase.co
   VITE_SUPABASE_ANON_KEY = (isi dari .env kamu)
   VITE_ARC_MARKETPLACE_ADDRESS = (isi dari .env kamu)
   VITE_ARC_CARDS_ADDRESS = (isi dari .env kamu)
   ```
6. Klik **Deploy**

### Step 4: Auto-Deploy Aktif ✅
Setiap kali kamu `git push origin master`, Vercel otomatis deploy.

---

## OPSI 3: Upload Manual via Vercel Dashboard

### Step 1: Build Locally
```powershell
cd c:\Users\Pongo\Downloads\arccc
npm run build
```

### Step 2: Upload ke Vercel
1. Buka https://vercel.com/dashboard
2. Klik **"Add New..."** → **Project**
3. Pilih **"Upload"** (bukan import dari Git)
4. Upload folder `dist` yang sudah di-build
5. Klik **Deploy**

⚠️ **Kekurangan:** Setiap update harus upload ulang manual.

---

## 🔍 Verify Deploy Berhasil

### Cek CSP Headers
Buka browser → F12 → Console → coba listing card.

Atau test via curl:
```powershell
curl -sI https://cardarc.vercel.app | findstr "Content-Security-Policy"
```

Pastikan output mengandung `rpc.walletconnect.org`.

### Cek Listing Flow
1. Buka https://cardarc.vercel.app
2. Connect wallet (MetaMask/Rainbow/etc)
3. Pilih card di My Cards
4. Klik **"List for Sale"**
5. Harusnya sekarang muncul progress:
   - **"Minting your card..."** ← step baru yang di-restore
   - **"Approving marketplace..."**
   - **"Listing your card..."**
   - **Success!** ✅

---

## ❌ Troubleshooting

### Error: "Card belum ter-mint on-chain"
→ Contract addresses belum ter-set di Vercel env vars. Cek `VITE_ARC_CARDS_ADDRESS` dan `VITE_ARC_MARKETPLACE_ADDRESS`.

### Error: CSP violation
→ CSP headers mungkin cached. Tunggu 1-2 menit atau hard refresh (Ctrl+Shift+R).

### Error: Build failed
→ Pastikan install command: `npm install --legacy-peer-deps`

### Error: "Cannot find module"
→ Jalankan `npm install` dulu sebelum build.