# 🚀 VERCEL DEPLOYMENT GUIDE

Complete guide to deploy ArcCards dApp to Vercel with multi-chain support and production-grade configuration.

---

## ⚡ QUICK DEPLOY (3 Steps)

### Step 1: Install Vercel CLI (Optional)

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
# From project root
vercel

# Production deployment
vercel --prod
```

---

## 🔧 METHOD 1: Vercel Dashboard (Recommended)

### 1.1 Connect Repository

1. Go to https://vercel.com/dashboard
2. Click **"Add New Project"**
3. Import your Git repository (GitHub/GitLab/Bitbucket)
4. Vercel auto-detects Vite configuration

### 1.2 Configure Build Settings

Vercel auto-detects these from `vercel.json`:

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install --legacy-peer-deps` |
| Node Version | 20.x (auto-detected from `package.json`) |

### 1.3 Set Environment Variables

Click **"Environment Variables"** in deployment settings:

#### **Required Variables**

```bash
# Active Chain Selection
VITE_ACTIVE_CHAIN=baseSepolia
# Options: baseSepolia, base, arc

# WalletConnect / Reown Project ID
# Get from: https://cloud.reown.com
VITE_REOWN_PROJECT_ID=your_reown_project_id

# App URL (must match deployed domain)
VITE_APP_URL=https://your-app.vercel.app
```

#### **Smart Contract Addresses (Base Sepolia)**

```bash
VITE_ARC_CARDS_ADDRESS=0xYourBaseSepoliaCardsAddress
VITE_ARC_MARKETPLACE_ADDRESS=0xYourBaseSepoliaMarketplaceAddress
```

#### **Smart Contract Addresses (Base Mainnet - Production)**

```bash
VITE_ARC_CARDS_ADDRESS_MAINNET=0xYourBaseMainnetCardsAddress
VITE_ARC_MARKETPLACE_ADDRESS_MAINNET=0xYourBaseMainnetMarketplaceAddress
```

#### **Supabase Configuration**

```bash
VITE_SUPABASE_URL=https://xswquwhtulshrvwkyjqu.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 1.4 Deploy

Click **"Deploy"** button. First deployment takes ~2-3 minutes.

---

## 🔧 METHOD 2: Vercel CLI

### 2.1 First-Time Setup

```bash
# Install CLI globally
npm i -g vercel

# Login
vercel login

# Link project (first time only)
vercel link
```

### 2.2 Set Environment Variables via CLI

```bash
# Production environment
vercel env add VITE_ACTIVE_CHAIN production
# Enter: baseSepolia (or base for mainnet)

vercel env add VITE_REOWN_PROJECT_ID production
# Enter: your_project_id

vercel env add VITE_APP_URL production
# Enter: https://your-app.vercel.app

vercel env add VITE_ARC_CARDS_ADDRESS production
# Enter: 0xYourContractAddress

vercel env add VITE_ARC_MARKETPLACE_ADDRESS production
# Enter: 0xYourMarketplaceAddress

vercel env add VITE_SUPABASE_URL production
# Enter: https://xswquwhtulshrvwkyjqu.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Enter: your_anon_key
```

### 2.3 Deploy Commands

```bash
# Preview deployment (test build)
vercel

# Production deployment
vercel --prod

# Deploy with specific environment
vercel --prod --env VITE_ACTIVE_CHAIN=base
```

### 2.4 Pull Environment Variables Locally

```bash
# Download production env vars to .env.local
vercel env pull .env.local
```

---

## 🌐 CUSTOM DOMAIN SETUP

### 3.1 Add Domain in Vercel

1. Go to **Project Settings → Domains**
2. Add your custom domain: `cardarc.com`
3. Follow DNS configuration instructions

### 3.2 Update DNS Records

**For apex domain (`cardarc.com`):**
```
Type: A
Name: @
Value: 76.76.21.21
```

**For subdomain (`www.cardarc.com`):**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 3.3 Update Environment Variables

```bash
# Update VITE_APP_URL to custom domain
VITE_APP_URL=https://cardarc.com

# Update Reown project to allow custom domain
# Go to: https://cloud.reown.com
# Add: cardarc.com to allowed domains
```

---

## 🌍 MULTI-CHAIN DEPLOYMENT STRATEGY

### Option A: Single Deployment, Multi-Chain Support

Deploy once, support all chains via UI switcher:

```bash
# All chains available in deployed app
VITE_ACTIVE_CHAIN=baseSepolia  # Default chain on load
# Users can switch chains in wallet UI
```

**Pros**: Single deployment, easier maintenance  
**Cons**: All chains load initially (slight bundle bloat)

### Option B: Multi-Branch Deployment

Deploy separate production environments per chain:

```bash
# Branch: main → Base Mainnet
VITE_ACTIVE_CHAIN=base

# Branch: staging → Base Sepolia
VITE_ACTIVE_CHAIN=baseSepolia

# Branch: arc → Arc Testnet
VITE_ACTIVE_CHAIN=arc
```

Vercel auto-deploys each branch to unique URLs:
- `main` → `cardarc.vercel.app`
- `staging` → `staging.cardarc.vercel.app`
- `arc` → `arc.cardarc.vercel.app`

**Pros**: Optimized bundles per chain, clear separation  
**Cons**: Multiple deployments to manage

---

## ✅ POST-DEPLOYMENT CHECKLIST

### 4.1 Verify Deployment

- [ ] Visit deployed URL
- [ ] Check browser console for errors
- [ ] Test wallet connection
- [ ] Verify network detection
- [ ] Test pack opening (mint NFT)
- [ ] Test marketplace listing
- [ ] Check transaction on BaseScan
- [ ] Verify Supabase data persistence
- [ ] Test on mobile device

### 4.2 Update Reown Project Settings

1. Go to https://cloud.reown.com
2. Select your project
3. **Allowed Domains**: Add your Vercel URL
   ```
   your-app.vercel.app
   cardarc.com
   www.cardarc.com
   ```
4. **Project Metadata**: Update URL and icons
5. Save changes

### 4.3 Update Smart Contract Whitelists

If using API keys (Alchemy, Infura), add Vercel IP ranges or configure CORS:

```javascript
// In contract backend config
const ALLOWED_ORIGINS = [
  'https://cardarc.vercel.app',
  'https://cardarc.com',
  'https://www.cardarc.com',
];
```

### 4.4 Configure Vercel Analytics (Optional)

1. Go to **Analytics** tab in Vercel dashboard
2. Enable Web Analytics
3. Add to `index.html`:

```html
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
```

### 4.5 Setup Error Monitoring (Optional)

Integrate Sentry for error tracking:

```bash
# Install
npm install @sentry/react

# Add to src/main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ACTIVE_CHAIN,
  tracesSampleRate: 0.1,
});
```

---

## 🔒 SECURITY HARDENING

### 5.1 Environment Variable Security

✅ **DO**:
- Use Vercel's encrypted environment variables
- Prefix all client-side vars with `VITE_`
- Rotate API keys every 90 days
- Use different keys for staging/production

❌ **DON'T**:
- Never commit `.env` files to Git
- Never expose private keys (`DEPLOYER_PRIVATE_KEY`) to frontend
- Never use production keys in preview deployments

### 5.2 CSP Headers (Already Configured)

The `vercel.json` includes production-grade Content Security Policy:

- ✅ `X-Frame-Options: DENY` (clickjacking protection)
- ✅ `X-Content-Type-Options: nosniff` (MIME sniffing protection)
- ✅ `Strict-Transport-Security` (HSTS with 2-year max-age)
- ✅ `Permissions-Policy` (camera/mic/geolocation disabled)
- ✅ `Content-Security-Policy` (strict CSP with allowed domains)

### 5.3 Rate Limiting (Vercel Built-in)

Vercel automatically applies rate limits:
- **Free Plan**: 100 requests/second
- **Pro Plan**: 1000 requests/second
- **Enterprise**: Custom limits

### 5.4 DDoS Protection

Vercel includes automatic DDoS protection on all plans. No configuration needed.

---

## 📊 PERFORMANCE OPTIMIZATION

### 6.1 Build Optimization

The project is already optimized with:

✅ **Code Splitting**: Vite automatic route-level splitting  
✅ **Tree Shaking**: Unused code eliminated  
✅ **Asset Hashing**: Long-term caching for immutable assets  
✅ **Minification**: ESBuild minification  
✅ **Gzip/Brotli**: Vercel auto-compresses responses  

### 6.2 CDN Configuration

Vercel automatically serves from global CDN:
- **Edge Locations**: 100+ worldwide
- **Cache Hit Rate**: ~95% for static assets
- **Cold Start**: <50ms for Vite SPA

### 6.3 Image Optimization

Use Vercel Image Optimization for NFT images:

```jsx
import Image from 'next/image'; // or use Vercel Image API

<Image
  src={nft.image}
  width={300}
  height={420}
  alt={nft.name}
  loader="vercel"
/>
```

### 6.4 Bundle Analysis

Check bundle size after build:

```bash
# Install analyzer
npm install --save-dev rollup-plugin-visualizer

# Build with analysis
npx vite build --mode production
```

---

## 🚨 TROUBLESHOOTING

### Issue: Build Fails with "Module not found"

**Solution**: Use legacy peer deps (already in `vercel.json`):
```json
"installCommand": "npm install --legacy-peer-deps"
```

### Issue: Environment Variables Not Working

**Solution**: Ensure all `VITE_` prefixed variables are set in Vercel dashboard, then redeploy.

### Issue: Wallet Connection Fails

**Solution**: 
1. Check Reown Project ID is correct
2. Verify domain is whitelisted in Reown dashboard
3. Check browser console for CSP violations
4. Ensure HTTPS is enabled (Vercel auto-provides)

### Issue: Supabase Connection Fails

**Solution**:
1. Verify Supabase URL and anon key
2. Check Supabase CORS settings (add Vercel domain)
3. Verify RLS policies allow access

### Issue: RPC Calls Fail (CORS Error)

**Solution**: Already handled in `vercel.json` CSP:
```
connect-src includes: 
  https://sepolia.base.org
  https://mainnet.base.org
  https://rpc.testnet.arc.network
```

---

## 📈 MONITORING & ANALYTICS

### 7.1 Vercel Analytics (Built-in)

Enable in dashboard → **Analytics** tab:
- Real User Monitoring (RUM)
- Web Vitals (LCP, FID, CLS)
- Geographic distribution
- Device/browser breakdown

### 7.2 Custom Analytics

Track Web3-specific metrics:

```javascript
// In src/lib/analytics.js
export const trackTransaction = (chain, hash, gasUsed) => {
  if (window.gtag) {
    window.gtag('event', 'transaction', {
      event_category: 'web3',
      event_label: chain,
      value: gasUsed,
      transaction_hash: hash,
    });
  }
};
```

### 7.3 Error Tracking

Monitor production errors:

```javascript
// In src/lib/errorReporting.js
window.addEventListener('error', (event) => {
  // Send to Sentry, LogRocket, or custom endpoint
  fetch('/api/log-error', {
    method: 'POST',
    body: JSON.stringify({
      message: event.message,
      stack: event.error?.stack,
      url: window.location.href,
      chain: import.meta.env.VITE_ACTIVE_CHAIN,
    }),
  });
});
```

---

## 🎯 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Smart contracts deployed to target network
- [ ] Contract addresses saved in environment variables
- [ ] Reown Project ID obtained
- [ ] Supabase project configured
- [ ] All API keys ready
- [ ] Domain purchased (if using custom domain)

### Deployment
- [ ] Vercel project created
- [ ] Environment variables configured
- [ ] First deployment successful
- [ ] Custom domain configured (if applicable)
- [ ] DNS propagated (24-48 hours)

### Post-Deployment
- [ ] Wallet connection works
- [ ] All chains accessible
- [ ] Pack opening functional
- [ ] Marketplace functional
- [ ] Supabase data persisting
- [ ] Reown domain whitelisted
- [ ] Analytics enabled
- [ ] Error monitoring active
- [ ] SSL certificate active (auto via Vercel)
- [ ] Performance metrics acceptable

---

## 💰 VERCEL PRICING

### Free Plan (Hobby)
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ Preview deployments
- ⚠️ 100 requests/second rate limit

### Pro Plan ($20/month)
- ✅ 1 TB bandwidth/month
- ✅ 1000 requests/second
- ✅ Team collaboration
- ✅ Password protection
- ✅ Advanced analytics

### Enterprise Plan (Custom)
- ✅ Custom bandwidth
- ✅ SSO/SAML
- ✅ SLA guarantee
- ✅ Priority support

**Recommendation**: Start with Free Plan, upgrade to Pro when you hit 100+ active users.

---

## 📚 USEFUL COMMANDS

```bash
# View deployment logs
vercel logs <deployment-url>

# List all deployments
vercel ls

# Promote preview to production
vercel promote <deployment-url>

# Remove deployment
vercel rm <deployment-url>

# Check deployment status
vercel inspect <deployment-url>

# Open deployment in browser
vercel open

# View environment variables
vercel env ls
```

---

## 🎉 SUCCESS!

Your ArcCards dApp is now live on Vercel with:
- ✅ Multi-chain support (Arc, Base Sepolia, Base Mainnet)
- ✅ Production-grade security headers
- ✅ Global CDN distribution
- ✅ Automatic HTTPS
- ✅ Zero-downtime deployments
- ✅ Preview deployments for testing

**Next Steps**:
1. Share deployment URL with beta testers
2. Monitor analytics and error reports
3. Deploy contracts to Base Mainnet when ready
4. Setup custom domain
5. Enable Vercel Analytics

---

**Need Help?** 
- Vercel Discord: https://vercel.com/discord
- Vercel Docs: https://vercel.com/docs
- Base Discord: https://discord.gg/buildonbase