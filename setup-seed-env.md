# 🚀 Quick Setup: Tambah Service Role Key

## Step 1: Get Service Role Key

1. Buka: https://supabase.com/dashboard/project/xswquwhtulshrvwkyjqu/settings/api
2. Copy key dengan label **`service_role`** (bukan anon)

## Step 2: Add ke Vercel (pilih salah satu)

### Option A: Via CLI (Tercepat)
```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste key saat diminta
# Redeploy:
vercel deploy --prod --yes
```

### Option B: Via Dashboard
1. Go to: https://vercel.com/ambyar112s-projects/arcard/settings/environment-variables
2. Add New:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: [paste service_role key]
   - Environment: ✅ Production
3. Save → Redeploy dari dashboard

## Step 3: Test
```bash
curl -X POST https://cardarc.vercel.app/api/seed ^
  -H "Authorization: Bearer arccc-seed-2026" ^
  -H "Content-Type: application/json"
```

Expected: `{"success":true,"profiles":{...},"marketplace":{...}}`

---

## ⚠️ PENTING: Jangan Add ke .env Local

Service role key HANYA untuk backend (Vercel serverless).
JANGAN ditambahkan ke `.env` local karena:
- Risk expose ke git
- Frontend tidak butuh service role key
- Hanya backend API yang perlu

---

## 📚 Full Tutorial

Lihat: `docs/COMPLETE_SEED_SETUP_TUTORIAL.md`