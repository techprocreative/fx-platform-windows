# MT5 Detection Guide

## ✅ MT5 Terdeteksi di Sistem Anda!

### MT5 Installation Details
```
Location: C:\Program Files\MetaTrader 5
Executable: terminal64.exe (126 MB)
Data Folder: %APPDATA%\MetaQuotes\Terminal\D0E8209F77C8...
MQL5 Folder: ✓ YES
Libraries: MQL5\Libraries
Experts: MQL5\Experts
```

---

## Cara Test MT5 Detection di Aplikasi

### Step 1: Jalankan Aplikasi
```bash
cd windows-executor
npm start
```

Atau double-click: `START_EXECUTOR.bat`

### Step 2: Setup Wizard Akan Muncul
Saat aplikasi pertama kali jalan, Setup Wizard akan muncul.

### Step 3: Check MT5 Detection
Di Step 1 Setup Wizard, Anda akan melihat:
- ✓ "Found X MT5 installation(s)"
- List lokasi MT5 yang terdeteksi

### Step 4: Klik "Start Auto-Installation"
- Auto-installer akan install `libzmq.dll` ke folder Libraries
- Auto-installer akan install Expert Advisor ke folder Experts

---

## Jika MT5 TIDAK Terdeteksi

### Troubleshooting Steps

#### 1. Pastikan MT5 Sudah Pernah Dijalankan
MT5 harus dijalankan minimal 1x untuk create data folders.

```bash
# Run MT5
"C:\Program Files\MetaTrader 5\terminal64.exe"
```

Login ke akun (demo atau real), tunggu sampai fully loaded, lalu close.

#### 2. Verify Data Folder Exists
Run script test:
```bash
node TEST_MT5_DETECTION.js
```

Harus menampilkan:
- ✓ FOUND (64-bit): C:\Program Files\MetaTrader 5
- ✓ Terminal data folder exists
- ✓ MQL5 folder: YES

#### 3. Check App Console
Saat jalankan aplikasi:
1. Tekan **Ctrl+Shift+I** untuk buka DevTools
2. Lihat tab **Console**
3. Cari log: "Found X MT5 installation(s)"
4. Jika ada error, screenshot dan report

#### 4. Clear App Config (Reset)
Jika masih tidak terdeteksi, reset config:

```powershell
# Hapus config
Remove-Item -Path "$env:APPDATA\fx-executor-config\config.json" -ErrorAction SilentlyContinue

# Jalankan ulang app
npm start
```

#### 5. Manual Path Input (Jika Detection Gagal)
Jika auto-detection gagal, Anda bisa input manual:

Saat Setup Wizard Step 1:
- Skip auto-installation
- Manually copy files:
  - Copy `resources\libs\libzmq.dll` → `%APPDATA%\MetaQuotes\Terminal\D0E8...\MQL5\Libraries\`
  - Copy `resources\experts\FX_Platform_Bridge.ex5` → `%APPDATA%\MetaQuotes\Terminal\D0E8...\MQL5\Experts\`

---

## MT5 Detection Paths (Dicek Otomatis)

Aplikasi akan otomatis cek lokasi berikut:

### 1. Standard Installations
- `C:\Program Files\MetaTrader 5` ✓ (Your MT5 is here!)
- `C:\Program Files (x86)\MetaTrader 5`
- `%LOCALAPPDATA%\Programs\MetaTrader 5`

### 2. Custom Locations
- `C:\MetaTrader 5`
- `C:\MT5`
- `C:\Trading\MetaTrader 5`

### 3. Registry Check
- `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*`
- Looking for: "MetaTrader 5" or "MT5"

### 4. AppData Portable
- `%APPDATA%\MetaQuotes\Terminal\*\origin.txt`

### 5. Running Processes
- Check for `terminal64.exe` or `terminal.exe`

---

## Expected Setup Flow

### 1. First Launch
```
Loading index.html...
First run detected, skipping controller initialization
Page finished loading
Window ready to show
```

### 2. Setup Wizard - Step 1
```javascript
Console logs:
"Initializing app..."
"Config loaded: No"
"Rendering setup wizard"
"Detecting MT5..."
"Found 1 MT5 installation(s)"
```

UI shows:
- ✓ MT5 Detection Status: FOUND
- Location: C:\Program Files\MetaTrader 5
- Build: XXXX
- Button: "Start Auto-Installation"

### 3. Auto-Installation Process
```
Installing libzmq.dll... ✓
Installing Expert Advisor... ✓
Creating config files... ✓
```

### 4. Setup Wizard - Step 2
Input API credentials:
- Executor ID
- API Key
- API Secret
- Test Connection

### 5. Setup Complete
App ready to receive commands!

---

## Debug Tools

### 1. Check MT5 Location
```bash
CHECK_MT5_LOCATION.bat
```

### 2. Test Detection Logic
```bash
node TEST_MT5_DETECTION.js
```

### 3. App Console (DevTools)
```
Press: Ctrl+Shift+I
Tab: Console
Look for: MT5 detection logs
```

---

## Files to Check Manually

### MT5 Executable
```
Location: C:\Program Files\MetaTrader 5\terminal64.exe
Size: ~126 MB
Should exist: YES ✓
```

### Data Folder
```
Location: %APPDATA%\MetaQuotes\Terminal\D0E8209F77C8...
Should contain:
- MQL5\Libraries\ folder
- MQL5\Experts\ folder
- origin.txt file
```

### Origin File
```
Location: %APPDATA%\MetaQuotes\Terminal\D0E8...\origin.txt
Content: C:\Program Files\MetaTrader 5
```

---

## Common Issues & Solutions

### Issue 1: "MT5 Not Found"
**Cause**: MT5 belum pernah dijalankan, data folder belum ada
**Solution**: Jalankan MT5 minimal 1x, login, tutup, restart app

### Issue 2: "Auto-Installation Failed"
**Cause**: Permission denied atau folder tidak ditemukan
**Solution**: 
- Run app as Administrator
- Atau copy files manually ke MQL5 folders

### Issue 3: "Detection Slow"
**Cause**: Checking multiple paths dan registry
**Solution**: Normal, tunggu 5-10 detik untuk detection selesai

### Issue 4: "Multiple MT5 Detected"
**Cause**: Ada beberapa instalasi MT5 (different brokers)
**Solution**: Pilih yang mau digunakan, atau install ke semua

---

## Verification Checklist

Setelah Setup Complete, verify:

- [ ] MT5 detected di Setup Wizard Step 1
- [ ] Auto-installation berhasil
- [ ] File `libzmq.dll` ada di `MQL5\Libraries\`
- [ ] File `FX_Platform_Bridge.ex5` ada di `MQL5\Experts\`
- [ ] API connection test berhasil
- [ ] App masuk ke Dashboard
- [ ] Tidak ada error di Console (Ctrl+Shift+I)

---

## Next Steps After MT5 Detected

1. ✅ MT5 terdeteksi
2. ✅ Auto-install libzmq.dll dan EA
3. ⏭️ Input API credentials
4. ⏭️ Test API connection
5. ⏭️ Complete setup
6. ⏭️ Test command execution from platform

---

## Support

Jika masih ada masalah dengan detection:
1. Run `TEST_MT5_DETECTION.js` dan screenshot output
2. Open DevTools (Ctrl+Shift+I) dan screenshot Console
3. Check logs folder untuk error details

**MT5 Location Confirmed**: `C:\Program Files\MetaTrader 5` ✅
