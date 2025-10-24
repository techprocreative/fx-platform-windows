# FX Platform Executor - Quick Start Guide

## ✅ Blank Screen Issue - RESOLVED!

Aplikasi sekarang berfungsi dengan baik. Blank screen sudah diperbaiki.

## Cara Menjalankan Aplikasi

### Opsi 1: Development Mode (Recommended untuk Testing)
```bash
cd windows-executor
npm run dev
```
- Hot reload enabled
- DevTools otomatis terbuka
- Cocok untuk development dan testing

### Opsi 2: Production Mode (Dari Build)
```bash
cd windows-executor
npm run build
npm start
```
- Build optimized
- Lebih cepat loading
- Cocok untuk production

### Opsi 3: Double-Click Launcher (Paling Mudah)
1. Double-click file `START_EXECUTOR.bat`
2. Aplikasi akan langsung jalan

## Verifikasi Aplikasi Jalan

Setelah menjalankan, Anda akan melihat log di terminal:
```
Loading index.html from: D:\baru\fx-platform-windows\windows-executor\dist\index.html
First run detected, skipping controller initialization
Page finished loading
Window ready to show
```

Dan window aplikasi akan muncul menampilkan **Setup Wizard**.

## First Run Setup

Aplikasi akan otomatis menampilkan Setup Wizard dengan 3 langkah:

### Step 1: MT5 Auto-Installation
1. Aplikasi akan auto-detect instalasi MT5 Anda
2. Klik "Start Auto-Installation"
3. Tunggu sampai:
   - ✅ libzmq.dll terinstall
   - ✅ Expert Advisor terinstall
   - ✅ Konfigurasi file dibuat

### Step 2: API Configuration
1. Masukkan credentials dari platform:
   - **Executor ID**: ID unik untuk executor ini
   - **API Key**: API key dari dashboard platform
   - **API Secret**: API secret dari dashboard platform
2. Klik "Test Connection"
3. Tunggu sampai koneksi berhasil

### Step 3: Ready to Trade
1. Verifikasi semua komponen terinstall
2. Klik "Start Executor"
3. Aplikasi akan mulai monitoring dan siap menerima command

## Debugging

### Buka DevTools (untuk melihat console logs)
Tekan: **Ctrl + Shift + I**

### Console Logs yang Normal
```javascript
Initializing app...
Config loaded: No
App not configured, showing setup wizard
Rendering setup wizard
App initialization complete
```

### Reset Configuration
Jika ada masalah dengan configuration, hapus file config:
```
%APPDATA%\fx-executor-config\config.json
```

## Icon Issue (Known Issue)

⚠️ **Icon terlalu kecil untuk packaging**
- Current icon: 67KB (< 256x256 px required)
- Electron-builder butuh minimal 256x256 pixels

### Temporary Workaround
Aplikasi bisa dijalankan langsung dengan `npm start` tanpa packaging.

### Permanent Solution (TODO)
1. Resize icon ke 256x256 pixels atau lebih besar
2. Atau buat icon baru dengan multiple sizes:
   - 16x16
   - 32x32
   - 48x48
   - 64x64
   - 128x128
   - 256x256
   - 512x512

## Distribusi Aplikasi

### Untuk Internal Testing (Tanpa Installer)

#### Cara 1: Copy Folder Lengkap
1. Copy seluruh folder `windows-executor` ke target machine
2. Install Node.js di target machine
3. Run: `npm install` (sekali saja)
4. Run: `npm start`

#### Cara 2: Portable dengan Electron
1. Copy folder `windows-executor` ke target machine
2. Include portable Node.js
3. Buat bat file untuk auto-run

### Untuk Production (Dengan Installer)
Butuh icon dengan size yang tepat terlebih dahulu.

## File Structure

```
windows-executor/
├── START_EXECUTOR.bat        ← Double-click untuk jalankan
├── dist/                      ← Build output
│   ├── index.html
│   ├── assets/
│   └── electron/
│       └── electron/
│           └── main.js        ← Entry point
├── resources/
│   ├── icons/
│   │   └── icon.ico          ← App icon (needs resize)
│   ├── libs/
│   │   └── libzmq.dll        ← ZeroMQ library
│   └── experts/
│       └── FX_Platform_Bridge.ex5  ← MT5 Expert Advisor
├── src/                       ← Source code
├── electron/                  ← Electron main process
└── node_modules/              ← Dependencies
```

## System Requirements

- **OS**: Windows 10 atau lebih baru
- **Node.js**: v18 atau lebih baru
- **MetaTrader 5**: Terinstall di sistem
- **RAM**: Minimal 4GB
- **Disk**: Minimal 500MB free space

## Troubleshooting

### 1. Blank Screen
✅ SOLVED - Sudah diperbaiki dengan:
- Fix path ke index.html
- Add error logging
- Add console debugging

### 2. Application Won't Start
Cek di terminal/console:
- Ada error di `npm start`?
- Port conflict?
- Missing dependencies? → Run `npm install`

### 3. MT5 Not Detected
- Pastikan MT5 terinstall di lokasi standard
- Check di: `C:\Program Files\MetaTrader 5`
- Atau lihat di Control Panel → Programs

### 4. API Connection Failed
- Cek API credentials
- Cek internet connection
- Cek firewall/antivirus tidak block
- Cek platform URL benar

### 5. Package Build Failed (Icon Error)
⚠️ Known issue - Icon size terlalu kecil.
**Workaround**: Jalankan dengan `npm start` tanpa packaging.

## Support

Jika masih ada masalah:
1. Buka DevTools (Ctrl+Shift+I)
2. Screenshot tab Console
3. Copy error messages
4. Check log files di folder `logs/`

## Next Steps After Setup

1. ✅ Aplikasi jalan
2. ✅ Setup wizard complete
3. ⏭️ Kirim test command dari platform
4. ⏭️ Verifikasi command execution di MT5
5. ⏭️ Monitor heartbeat di platform dashboard
6. ⏭️ Test trade execution
7. ⏭️ Monitor logs untuk errors

## Status Saat Ini

- [x] ✅ Aplikasi bisa jalan (tidak blank screen lagi)
- [x] ✅ Setup wizard muncul
- [x] ✅ Console logging berfungsi
- [x] ✅ DevTools bisa dibuka
- [ ] ⏭️ Icon perlu di-resize untuk packaging
- [ ] ⏭️ Testing integrasi dengan platform
- [ ] ⏭️ Testing command execution
- [ ] ⏭️ Testing trade execution

**Kesimpulan**: Aplikasi SIAP untuk digunakan! Cukup jalankan dengan `npm start` atau double-click `START_EXECUTOR.bat`.
