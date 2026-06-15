# Wallet Recovery Guide

## Masalah: Wallet Tidak Otomatis Terkoneksi Setelah Restart Laptop

Setelah laptop mati atau restart, wallet mungkin tidak otomatis terkoneksi. Ini disebabkan oleh:

1. **LocalStorage Session Management**: Sistem menggunakan timestamp untuk sesi dengan timeout 4 jam
2. **Wagmi Auto-reconnect**: Wagmi mencoba auto-reconnect saat aplikasi load
3. **Session Clear Logic**: Jika session dianggap expired (4+ jam), data wallet dihapus sebelum Wagmi bisa reconnect

## Solusi yang Sudah Diimplementasikan

### 1. Tombol "Reconnect" Otomatis
- Tombol "🔄 Reconnect" akan muncul otomatis setelah 2 detik jika wallet tidak terkoneksi
- Klik tombol ini untuk membersihkan connector state dan trigger reconnection
- Tombol hanya muncul di status "not connected"

### 2. Fitur "Debug Wallet" di Profile Menu
- Klik avatar/profile icon untuk membuka dropdown menu
- Pilih "🔍 Debug Wallet" untuk melihat:
  - Status session di localStorage
  - Umur session (dalam jam)
  - Kunci WalletConnect/AppKit/Wagmi yang tersimpan
  - Alamat wallet yang disimpan

### 3. Manual Recovery dari Console
Anda juga bisa menjalankan perintah manual dari browser console (F12 → Console):

```javascript
// Debug wallet state
debugWalletState()

// Safe recovery - hanya clear connector, preserve session
safeWalletRecovery()

// Force recovery - clear semua wallet data
forceWalletRecovery()
```

## Langkah-langkah Reconnect Manual

Jika wallet tidak terkoneksi setelah restart laptop:

### Option 1: Gunakan Tombol "🔄 Reconnect"
1. Tunggu 2 detik setelah page load
2. Klik tombol "🔄 Reconnect" yang muncul di sebelah "Connect Wallet"
3. Halaman akan reload otomatis
4. Wallet akan otomatis reconnect

### Option 2: Gunakan Profile Menu
1. Klik avatar/profile icon (kanan atas)
2. Pilih "🔍 Debug Wallet"
3. Periksa status di console (F12 → Console)
4. Klik "🔄 Reconnect" jika tombol tersedia

### Option 3: Manual dari Console
1. Buka browser console (F12 → Console)
2. Ketik `debugWalletState()` dan tekan Enter
3. Lihat status session
4. Jika ada session valid, ketik `safeWalletRecovery()`
5. Jika tidak ada session, hubungkan wallet manual

## Troubleshooting

### Masalah 1: Tombol "Reconnect" Tidak Muncul
- Tunggu minimal 2 detik
- Refresh halaman (Ctrl+F5)
- Cek console untuk error

### Masalah 2: Wallet Masih Tidak Terkoneksi
1. Buka Console (F12)
2. Jalankan `debugWalletState()`
3. Jika sessionAge > 4 jam, session sudah expired
4. Klik "Connect Wallet" untuk menghubungkan ulang

### Masalah 3: LocalStorage Kosong
Setelah restart laptop, localStorage mungkin kosong:
- Ini normal untuk restart sistem
- Klik "Connect Wallet" untuk menghubungkan ulang
- Session baru akan dibuat otomatis

## Konfigurasi Teknis

### Timeout Settings
- **SESSION_TTL_MS**: 4 jam (14,400,000 ms)
- **Auto-reconnect timer**: 2 detik
- **Session persistence**: 7 hari (di useWalletConnection)

### File-file Utama
1. `src/lib/wagmi.js` - Session management & timeout logic
2. `src/hooks/useWalletConnection.ts` - Auto-reconnect attempt
3. `src/lib/walletRecovery.ts` - Recovery utilities
4. `src/components/Header.jsx` - UI recovery buttons

## Catatan Pengembang

Perubahan terbaru yang diimplementasikan:
1. **Fixed Session Clear Logic**: Wagmi diberi kesempatan auto-reconnect sebelum session di-clear
2. **Enhanced Auto-reconnect**: Timeout manual attempt jika Wagmi gagal
3. **UI Recovery Tools**: Tombol dan debug tools untuk user
4. **Session Persistence**: Session disimpan 7 hari (tidak 4 jam)

Jika masalah tetap berlanjut, silakan periksa:
1. Browser extension wallet (Metamask, etc.) status
2. Network connection
3. Console untuk error messages