# 🌱 Database Seeding Guide

## Overview
This guide explains how to populate the marketplace with sample listings using the `/api/seed` endpoint.

## Prerequisites

### 1. Get Supabase Service Role Key

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/xswquwhtulshrvwkyjqu
2. Navigate to **Settings** → **API**
3. Find the **service_role** key (NOT the anon key)
4. Copy the service_role key

⚠️ **Security Warning**: The service_role key bypasses Row Level Security (RLS). Never expose it in client-side code.

### 2. Add Environment Variable to Vercel

#### Option A: Via Vercel Dashboard
1. Go to https://vercel.com/ambyar112s-projects/arcard/settings/environment-variables
2. Add new environment variable:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Your service_role key from Supabase
   - **Environments**: Select all (Production, Preview, Development)
3. Click **Save**
4. Redeploy the project for changes to take effect

#### Option B: Via Vercel CLI
```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY
# Paste your service_role key when prompted
# Select all environments
```

Then redeploy:
```bash
vercel deploy --prod --yes
```

### 3. Optional: Add Custom Seed Secret

By default, the seed endpoint uses `arccc-seed-2026` as the authorization token. You can override this:

```bash
vercel env add SEED_SECRET
# Enter your custom secret
```

## Triggering the Seed

### Method 1: Using curl (Windows PowerShell)
```powershell
curl.exe -X POST "https://cardarc.vercel.app/api/seed" `
  -H "Authorization: Bearer arccc-seed-2026" `
  -H "Content-Type: application/json"
```

### Method 2: Using curl (Linux/Mac)
```bash
curl -X POST "https://cardarc.vercel.app/api/seed" \
  -H "Authorization: Bearer arccc-seed-2026" \
  -H "Content-Type: application/json"
```

### Method 3: Using the shell script
```bash
chmod +x trigger-seed.sh
./trigger-seed.sh
```

### Method 4: Using Postman or Insomnia
- **Method**: POST
- **URL**: `https://cardarc.vercel.app/api/seed`
- **Headers**:
  - `Authorization`: `Bearer arccc-seed-2026`
  - `Content-Type`: `application/json`

## Expected Response

### Success (HTTP 200)
```json
{
  "success": true,
  "profiles_created": 5,
  "listings_created": 5,
  "message": "Marketplace seeded successfully!"
}
```

### Error: Missing Service Key (HTTP 500)
```json
{
  "error": "SUPABASE_SERVICE_ROLE_KEY not configured in Vercel env vars",
  "hint": "Add SUPABASE_SERVICE_ROLE_KEY to Vercel project settings"
}
```

### Error: Unauthorized (HTTP 401)
```json
{
  "error": "Unauthorized"
}
```

## What Gets Seeded

### Profiles (5 sellers)
- `0x1234567890123456789012345678901234567890`
- `0x2345678901234567890123456789012345678901`
- `0x3456789012345678901234567890123456789012`
- `0x4567890123456789012345678901234567890123`
- `0x5678901234567890123456789012345678901234`

Each profile has:
- Username: `seller_<first6chars>`
- Level: 10
- Legendary count: 5

### Marketplace Listings (5 cards)

1. **Pikachu VMAX** (Pokemon, Legendary, 50 USDC)
2. **Blue-Eyes White Dragon** (Yu-Gi-Oh!, Epic, 35.50 USDC)
3. **Son Goku** (Dragon Ball, Rare, 25 USDC)
4. **Charizard ex** (Pokemon, Legendary, 75 USDC)
5. **Dark Magician** (Yu-Gi-Oh!, Epic, 40 USDC)

## Idempotency

The seed endpoint is **idempotent** - you can run it multiple times safely:
- Profiles are upserted (updated if exist, created if not)
- Existing marketplace listings are cleared before inserting new ones
- No duplicate data will be created

## Verification

After seeding, verify the data:

### Check Supabase Database
1. Go to Supabase project → **Table Editor**
2. Verify `profiles` table has 5 entries
3. Verify `marketplace` table has 5 listings with `status = 'active'`

### Check the Live Site
1. Visit https://cardarc.vercel.app/marketplace
2. Click on the **"Browse"** tab
3. You should see 5 cards displayed
4. Filter by set (Pokemon, Yu-Gi-Oh!, Dragon Ball) to verify filtering works

## Troubleshooting

### "0 listings found" after seeding
- Clear browser cache and hard refresh (Ctrl+Shift+R)
- Check Supabase Table Editor to confirm data exists
- Check browser console for errors

### Seed endpoint returns 500
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Redeploy after adding environment variables
- Check Vercel deployment logs for detailed errors

### Unauthorized error
- Verify the Authorization header matches the `SEED_SECRET` env var
- Default is `Bearer arccc-seed-2026`

## Security Notes

1. **Production Consideration**: In production, consider removing or securing this endpoint
2. **IP Whitelist**: Add IP whitelisting for additional security
3. **Rate Limiting**: Consider adding rate limiting to prevent abuse
4. **Service Key**: Never commit the service_role key to git
5. **Audit Logs**: Monitor Supabase audit logs for unauthorized access

## Next Steps

After seeding:
1. Test marketplace browsing and filtering
2. Test listing creation from the UI
3. Deploy smart contracts and sync on-chain data
4. Implement real-time event listeners for blockchain events