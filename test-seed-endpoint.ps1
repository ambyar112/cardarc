# Test seed endpoint after Vercel deployment
Invoke-RestMethod -Uri "https://cardarc.vercel.app/api/seed" -Method Post -Headers @{Authorization="Bearer arccc-seed-2026"}