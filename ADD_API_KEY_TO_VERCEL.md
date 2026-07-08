# ⚡ CARA TAMBAH SEED_API_KEY KE VERCEL (2 MENIT)

## 🎯 YANG PERLU DITAMBAHKAN

```
Key:   SEED_API_KEY
Value: WXFxkaKWGxqVwDQb0z1r1G+IGGZlsMmRNyyk4uUja14=
```

---

## 📋 STEP-BY-STEP (DENGAN SCREENSHOT REFERENCES)

### 1. Buka Vercel Dashboard
- URL: https://vercel.com/dashboard
- Login jika belum

### 2. Pilih Project "cardarc"
- Klik project name dari list
- Atau search "cardarc" di search bar

### 3. Masuk ke Settings
- Klik tab **"Settings"** di top navigation
- Sidebar kiri akan muncul

### 4. Pilih Environment Variables
- Di sidebar kiri, klik **"Environment Variables"**
- Atau scroll ke section "Environment Variables"

### 5. Klik "Add New"
- Button di kanan atas: **"Add New Variable"** atau **"Add"**
- Form popup akan muncul

### 6. Isi Form
**Field 1 - Key/Name:**
```
SEED_API_KEY
```

**Field 2 - Value:**
```
WXFxkaKWGxqVwDQb0z1r1G+IGGZlsMmRNyyk4uUja14=
```

**Field 3 - Environments (PENTING!):**
- ✅ **Production** (WAJIB)
- ✅ **Preview** (RECOMMENDED)
- ✅ **Development** (RECOMMENDED)

**Centang SEMUA 3 checkbox!**

### 7. Save
- Klik button **"Save"** atau **"Add"**
- Environment variable akan muncul di list

### 8. Verifikasi
Pastikan terlihat di list:
```
SEED_API_KEY: WXFxkaK... (Production, Preview, Development)
```

---

## ✅ SELESAI!

Vercel akan otomatis:
- ✅ Apply variable ke deployment saat ini
- ✅ Use variable di deployment selanjutnya
- ✅ Expose ke serverless functions

**Backend auth sudah aktif setelah ini!**

---

## 🔍 CARA TEST (OPTIONAL)

Setelah tambah variable, test seed endpoint:

```bash
curl -X POST https://cardarc.vercel.app/api/seed
```

**Expected Response:**
```json
{"error":"Unauthorized: Missing or invalid API key"}
```

Ini artinya auth sudah kerja! ✅

Jika ada API key header:
```bash
curl -X POST https://cardarc.vercel.app/api/seed \
  -H "Authorization: Bearer WXFxkaKWGxqVwDQb0z1r1G+IGGZlsMmRNyyk4uUja14="
```

**Expected:** Seed process starts (authorized)

---

## ⚠️ TROUBLESHOOTING

**Problem:** Tidak ada button "Add New"
- **Solution:** Ensure kamu sudah login dan punya access ke project

**Problem:** Form tidak save
- **Solution:** Pastikan semua field terisi dengan benar

**Problem:** API masih return error setelah add
- **Solution:** Wait 1-2 menit untuk Vercel propagate changes

**Problem:** Lupa environment yang mana
- **Solution:** Centang SEMUA (Production, Preview, Development)

---

## 🚀 NEXT STEP

Setelah selesai tambah API key:
1. ✅ Backend auth sudah aktif
2. ⏳ Frontend integration (saya lanjut otomatis)
3. ⏳ Git push frontend changes
4. ⏳ Complete deployment

**Lagi proses frontend integration sekarang...**