# Tutorial Lengkap: Setup Database Seeding untuk ArcCards

## 📋 Status Saat Ini

Sudah selesai:
- ✅ SQL functions untuk bypass RLS sudah dibuat (`supabase_seed_bypass.sql`)
- ✅ API endpoint sudah diupdate untuk menggunakan RPC (`api/seed.js`)
- ✅ Code sudah di-deploy ke Vercel
- ⚠️ **BELUM**: Environment variable `SUPABASE_SERVICE_ROLE_KEY` di Vercel

## 🎯 Yang Perlu Diselesaikan

Tinggal 1 langkah: **Tambahkan Service Role Key ke Vercel**

---

## 📝 Langkah-Langkah Lengkap

### Step 1: Dapatkan Service Role Key dari Supabase

1. Buka Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/xswquwhtulshrvwkyjqu/settings/api
   ```

2. Scroll ke bawah sampai menemukan **"Project API keys"**

3. Copy key yang berlabel **`service_role`** (BUKAN `anon`)
   - Key ini terenkripsi dan sangat rahasia
   - Jangan share ke publik atau commit ke git
   - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (panjang ~200+ karakter)

---

### Step 2A: Tambahkan ke Vercel via CLI (Cara Tercepat)

```bash
# Di terminal, pastikan di folder project
cd c:/Users/Pongo/Downloads/arccc

# Tambahkan env variable
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Paste service role key yang sudah di-copy
# Tekan Enter

# Redeploy
vercel deploy --prod --yes
```

---

### Step 2B: Tambahkan via Vercel Dashboard (Alternatif)

1. Buka Vercel Dashboard:
   ```
   https://vercel.com/ambyar112s-projects/arcard/settings/environment-variables
   ```

2. Klik tombol **"Add New"**

3. Isi form:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste service role key dari Step 1
   - **Environments**: Centang **Production** saja
   - **Type**: Leave as "Plain Text" (Vercel akan encrypt otomatis)

4. Klik **"Save"**

5. Redeploy project:
   - Go to: https://vercel.com/ambyar112s-projects/arcard
   - Klik 3 dots (⋮) di deployment terakhir
   - Pilih **"Redeploy"**
   - Confirm

---

### Step 3: Test Seed Endpoint

Setelah redeploy selesai (~1-2 menit):

```bash
# Test via curl
curl -X POST https://cardarc.vercel.app/api/seed \
  -H "Authorization: Bearer arccc-seed-2026" \
  -H "Content-Type: application/json"
```

**Expected Response (Success):**
```json
{
  "success": true,
  "profiles": { "profiles_created": 10 },
  "marketplace": { "listings_created": 15 }
}
```

**Jika Masih Error:**

Error `Invalid API key`:
- Service role key belum di-set atau salah
- Double check key yang di-copy lengkap (tidak terpotong)
- Re-check environments harus Production

Error `function seed_profiles does not exist`:
- SQL functions belum dijalankan
- Buka: https://supabase.com/dashboard/project/xswquwhtulshrvwkyjqu/sql
- Copy paste isi file `supabase_seed_bypass.sql`
- Run

Error `Unauthorized`:
- Header Authorization salah
- Harus: `Bearer arccc-seed-2026` (dengan spasi)

---

### Step 4: Verifikasi Data Terseeding

1. Cek tabel Profiles:
   ```
   https://supabase.com/dashboard/project/xswquwhtulshrvwkyjqu/editor/profiles
   ```
   - Harus ada 10 rows dengan wallet addresses

2. Cek tabel Marketplace:
   ```
   https://supabase.com/dashboard/project/xswquwhtulshrvwkyjqu/editor/marketplace
   ```
   - Harus ada 15+ listings

3. Test di website:
   ```
   https://cardarc.vercel.app/marketplace
   ```
   - Cards harus muncul
   - Leaderboard harus ada users

---

## 🔧 Troubleshooting

### Problem: "Cannot connect to Supabase"

**Solution:**
```bash
# Test koneksi langsung
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('profiles').select('count').then(console.log);
"
```

### Problem: "RLS policy violated"

**Solution:**
Functions dengan `SECURITY DEFINER` sudah bypass RLS, tapi butuh service role key untuk dieksekusi. Pastikan:
1. SQL functions sudah di-run
2. `GRANT EXECUTE` sudah ada di akhir SQL
3. Service role key benar

### Problem: Deploy gagal dengan "Module not found"

**Solution:**
```bash
# Clear cache dan reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
git add package-lock.json
git commit -m "fix: reinstall dependencies"
vercel deploy --prod --yes
```

---

## 📊 Arsitektur Seeding

```
API Request (POST /api/seed)
    ↓
Authorization Check (Bearer token)
    ↓
api/seed.js (Node.js backend)
    ↓
Supabase Client (dengan service_role key)
    ↓
RPC Functions (seed_profiles, seed_marketplace)
    ↓ [SECURITY DEFINER - bypass RLS]
    ↓
PostgreSQL Database (INSERT data)
    ↓
Response JSON
```

**Kenapa Service Role Key?**
- Anon key = read-only + RLS enabled
- Service role key = full access + bypass RLS
- RPC functions dengan `SECURITY DEFINER` perlu service role untuk bypass RLS
- Backend-only operation, tidak expose ke frontend

---

## 🔐 Security Notes

1. **NEVER** commit service role key ke git
2. Service role key di Vercel = encrypted at rest
3. Seed endpoint protected dengan Bearer token (`arccc-seed-2026`)
4. Production: Ganti token ke UUID random atau JWT
5. Consider rate limiting di Vercel Edge Config

---

## ✅ Checklist Completion

- [x] SQL functions created (`supabase_seed_bypass.sql`)
- [x] API endpoint updated (`api/seed.js`)
- [x] Code deployed to Vercel
- [ ] **SUPABASE_SERVICE_ROLE_KEY added to Vercel** ← YOU ARE HERE
- [ ] Redeploy triggered
- [ ] Test endpoint successful
- [ ] Data verified in Supabase tables
- [ ] Frontend shows seeded data

---

## 🚀 Next Steps After Seeding

1. **Production Security:**
   ```bash
   # Generate secure token
   node -e "console.log(require('crypto').randomUUID())"
   # Update Bearer token di api/seed.js
   ```

2. **Automated Seeding (Optional):**
   ```bash
   # Add to package.json
   "scripts": {
     "seed": "node -e \"fetch('https://cardarc.vercel.app/api/seed',{method:'POST',headers:{'Authorization':'Bearer TOKEN'}}).then(r=>r.json()).then(console.log)\""
   }
   ```

3. **Monitoring:**
   - Setup Vercel Analytics
   - Add Sentry error tracking
   - Monitor Supabase usage/quota

---

## 📞 Need Help?

Jika masih stuck:
1. Check Vercel deployment logs: https://vercel.com/ambyar112s-projects/arcard/deployments
2. Check Supabase logs: https://supabase.com/dashboard/project/xswquwhtulshrvwkyjqu/logs/explorer
3. Verify env vars: `vercel env ls`

---

**Last Updated**: June 21, 2026  
**Status**: Waiting for Step 2 (Add Service Role Key)