# Blank Screen Issue - RESOLVED ✅

## Masalah
Aplikasi menampilkan blank screen saat dijalankan.

## Root Cause
1. **Path Error**: File `index.html` di production tidak bisa ditemukan karena path yang salah
   - Production: `main.js` ada di `dist/electron/electron/main.js`
   - File `index.html` ada di `dist/index.html`
   - Path lama: `../index.html` (salah, hanya naik 1 level)
   - Path baru: `../../index.html` (benar, naik 2 level)

2. **Kurangnya Logging**: Tidak ada console logging untuk debugging

## Solusi yang Diterapkan

### 1. Fix Path Index.html ✅
**File**: `electron/main.ts`

```typescript
// SEBELUM (SALAH)
pathname: path.join(__dirname, '../index.html')

// SESUDAH (BENAR)
const indexPath = path.join(__dirname, '../../index.html');
console.log('Loading index.html from:', indexPath);
pathname: indexPath
```

### 2. Tambah Error Logging ✅
**File**: `electron/main.ts`

```typescript
// Log loading errors
mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
  console.error('Failed to load:', errorCode, errorDescription);
});

// Log success
mainWindow.webContents.on('did-finish-load', () => {
  console.log('Page finished loading');
});
```

### 3. Enable DevTools di Production ✅
**File**: `electron/main.ts`

```typescript
// Tekan Ctrl+Shift+I untuk buka DevTools
mainWindow.webContents.on('before-input-event', (event, input) => {
  if (input.control && input.shift && input.key.toLowerCase() === 'i') {
    mainWindow?.webContents.toggleDevTools();
    event.preventDefault();
  }
});
```

### 4. Tambah Console Logging di React App ✅
**File**: `src/app/App.tsx`

```typescript
console.log('Initializing app...');
console.log('Config loaded:', config ? 'Yes' : 'No');
console.log('App is configured, showing dashboard');
console.log('App not configured, showing setup wizard');
console.log('Rendering loading screen');
console.log('Rendering setup wizard');
```

## Cara Menjalankan

### Development Mode
```bash
cd windows-executor
npm run dev
```

### Production Mode (Dari Build)
```bash
cd windows-executor
npm run build
npm start
```

## Hasil Testing

### ✅ Log Output (Sukses)
```
Loading index.html from: D:\baru\fx-platform-windows\windows-executor\dist\index.html
First run detected, skipping controller initialization
Page finished loading
Window ready to show
```

**Status**: Aplikasi berhasil load dan menampilkan Setup Wizard!

## First Run - Setup Wizard

Saat pertama kali dijalankan, aplikasi akan menampilkan **Setup Wizard** dengan 3 langkah:

### Step 1: MT5 Auto-Installation
- Deteksi otomatis instalasi MT5
- Install `libzmq.dll` ke MT5
- Install Expert Advisor `FX_Platform_Bridge.ex5`

### Step 2: API Configuration
- Masukkan **Executor ID**
- Masukkan **API Key**
- Masukkan **API Secret**
- Test koneksi ke platform

### Step 3: Final Verification
- Verifikasi semua komponen terinstall
- Mulai monitoring

## Debugging Tips

### Jika Masih Blank Screen
1. Tekan **Ctrl+Shift+I** untuk buka DevTools
2. Cek tab **Console** untuk error messages
3. Cek tab **Network** untuk failed requests
4. Lihat log di terminal/command prompt

### Check Console Logs
Buka DevTools (Ctrl+Shift+I) dan lihat console untuk:
- ✓ "Initializing app..."
- ✓ "Config loaded: No" (first run)
- ✓ "Rendering setup wizard"

### Common Issues

#### 1. Config Store Error
```javascript
// Error: Cannot read property of undefined
// Fix: Reset config
```
Hapus file config: `%APPDATA%\fx-executor-config\config.json`

#### 2. Module Not Found
```javascript
// Error: Cannot find module 'electron-store'
// Fix: Reinstall dependencies
```
```bash
npm install
```

#### 3. Port Already in Use (Dev Mode)
```bash
# Error: Port 5173 already in use
# Fix: Kill process atau ganti port
```
Kill process di port 5173 atau edit `vite.config.ts`

## Package untuk Distribusi

### Sementara (Tanpa Icon)
```bash
npm run build
# Copy folder 'windows-executor' ke target machine
# Jalankan: npm start
```

### Full Package (Perlu Icon)
1. Buat icon file di `resources/icons/icon.ico`
2. Jalankan:
```bash
npm run package:win
```

Output: `dist/win-unpacked/FX Platform Executor.exe`

## File Structure (Production Build)

```
windows-executor/
├── dist/
│   ├── index.html                    ← React App
│   ├── assets/
│   │   ├── index-*.js
│   │   ├── index-*.css
│   │   └── vendor-*.js
│   └── electron/
│       └── electron/
│           ├── main.js               ← Entry Point
│           ├── preload.js
│           └── ...
├── node_modules/
├── resources/
│   ├── libs/                         ← libzmq.dll
│   └── experts/                      ← FX_Platform_Bridge.ex5
└── package.json
```

## Next Steps

1. ✅ App sekarang berjalan dengan benar
2. ✅ Setup wizard muncul
3. ⏭️ Lengkapi setup wizard (MT5, API credentials)
4. ⏭️ Test koneksi ke platform
5. ⏭️ Test eksekusi command
6. ⏭️ Buat icon untuk packaging final

## Verification Checklist

- [x] Build succeeds (0 TypeScript errors)
- [x] App loads without blank screen
- [x] Setup wizard appears on first run
- [x] Console logging works
- [x] DevTools can be opened (Ctrl+Shift+I)
- [ ] MT5 auto-detection works
- [ ] API connection test works
- [ ] Command execution works
- [ ] Heartbeat sends to platform

## Support

Jika masih ada masalah:
1. Tekan **Ctrl+Shift+I** untuk buka DevTools
2. Screenshot tab **Console**
3. Screenshot tab **Network** (jika ada failed requests)
4. Copy error message dari console
