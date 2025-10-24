# Windows Executor - Build & Package Instructions

## Status Aplikasi

✅ **Aplikasi Sudah Berfungsi dengan Baik!**
- Build: Success (0 errors)
- Blank screen issue: Fixed
- Setup wizard: Working

## Cara Menjalankan

### Option 1: Development Mode (Recommended)
```bash
npm run dev
```

### Option 2: Production Mode
```bash
npm run build
npm start
```

### Option 3: Quick Launch
Double-click: `START_EXECUTOR.bat`

## Icon Issue

### Current Problem
```
⨯ image D:\baru\fx-platform-windows\windows-executor\resources\icons\icon.ico must be at least 256x256
```

File `icon.ico` saat ini masih terlalu kecil (67KB).

### Solution: Ganti Icon dengan Size yang Benar

#### Cara 1: Buat Icon Baru dengan IcoFX atau Icon Editor Online

1. **Download icon editor gratis**:
   - IcoFX: https://icofx.ro/
   - GIMP (free): https://www.gimp.org/
   - Online: https://www.favicon-generator.org/

2. **Buat multi-resolution icon**:
   - 16x16 pixels
   - 32x32 pixels
   - 48x48 pixels
   - 64x64 pixels
   - 128x128 pixels
   - **256x256 pixels** (REQUIRED)
   - 512x512 pixels (optional, recommended)

3. **Save sebagai icon.ico**

4. **Replace file**:
   ```
   Copy icon ke: windows-executor\resources\icons\icon.ico
   ```

#### Cara 2: Convert PNG ke ICO (Multiple Sizes)

Jika punya logo PNG 512x512:

1. Upload ke: https://convertio.co/png-ico/
2. Set output sizes:
   - ✓ 16x16
   - ✓ 32x32
   - ✓ 48x48
   - ✓ 256x256
   - ✓ 512x512
3. Download dan rename ke `icon.ico`
4. Copy ke `resources/icons/icon.ico`

#### Cara 3: Gunakan Default Electron Icon (Temporary)

Untuk testing cepat tanpa custom icon:

```json
// Edit electron-builder.json
{
  "win": {
    "target": ["dir"],
    // Hapus baris "icon": "resources/icons/icon.ico"
  }
}
```

Kemudian:
```bash
npm run package:dir
```

Output: `dist/win-unpacked/FX Platform Executor.exe`

## Package Commands

### Build Only (No Package)
```bash
npm run build
```
Output: `dist/` folder

### Package Portable (Tanpa Installer)
```bash
npm run package:dir
```
Output: `dist/win-unpacked/FX Platform Executor.exe`

### Package NSIS Installer (Butuh Icon)
```bash
npm run package:win
```
Output:
- `dist/FX Platform Executor Setup 1.0.0.exe` (NSIS installer)
- `dist/FX Platform Executor 1.0.0.exe` (Portable)

## Verify Icon Size

### Check Current Icon
```powershell
Get-Item "resources\icons\icon.ico" | Select-Object Name, Length
```

Expected output:
- Length: > 200,000 bytes (untuk multi-resolution)

### Check Icon Dimensions (Windows)
1. Right-click `icon.ico`
2. Properties → Details tab
3. Lihat Dimensions

Harus ada minimal: **256x256** atau lebih

## Troubleshooting

### 1. Icon Still Too Small
**Problem**: File size masih 67KB
**Solution**: 
- Pastikan file sudah di-overwrite/replace
- Restart IDE/Editor
- Check file dengan `Get-Item` command
- Verify last modified time

### 2. Package Failed - Native Dependencies
**Problem**: better-sqlite3 build error
**Solution**:
```bash
npm run rebuild
```

### 3. Cannot Create Installer
**Problem**: Icon error
**Temporary Solution**: Use dir target
```bash
# Edit electron-builder.json
"target": ["dir"]

# Then package
npm run package:dir
```

### 4. App Doesn't Start After Package
**Problem**: File not found
**Solution**: Check `dist/win-unpacked/resources/`
- Verify `app.asar` exists
- Verify `libs/` folder exists
- Verify `experts/` folder exists

## Distribution

### Internal Testing
Cara termudah untuk testing:
1. Copy seluruh folder `windows-executor`
2. Install Node.js di target machine
3. Run: `npm install`
4. Run: `npm start`

### Production Distribution

#### Dengan Installer (NSIS)
Setelah icon fix:
```bash
npm run package:win
```
Bagikan: `dist/FX Platform Executor Setup 1.0.0.exe`

#### Portable (Tanpa Install)
```bash
npm run package:dir
```
Zip folder: `dist/win-unpacked/`
Extract & run `FX Platform Executor.exe`

## Current Status Checklist

- [x] ✅ TypeScript compilation: 0 errors
- [x] ✅ React build: Success
- [x] ✅ Electron build: Success
- [x] ✅ Application runs: Working
- [x] ✅ Setup wizard: Working
- [x] ✅ DevTools: Accessible (Ctrl+Shift+I)
- [x] ✅ Console logging: Working
- [ ] ⏳ Icon: Needs replacement (256x256+)
- [ ] ⏳ Package installer: Waiting for icon
- [ ] ⏳ Integration test: Pending
- [ ] ⏳ Command execution test: Pending

## Next Steps

### Immediate (Before Packaging)
1. **Fix Icon** (REQUIRED)
   - Replace `resources/icons/icon.ico` dengan icon 256x256+
   - Verify dengan `Get-Item` command

2. **Test Package**
   ```bash
   npm run package:win
   ```

3. **Test Installer**
   - Install di clean Windows machine
   - Verify shortcuts created
   - Verify app runs

### After Successful Package
1. Test integration dengan platform
2. Test command execution
3. Test trade execution
4. Create installation guide
5. Create user manual

## File Locations After Package

```
dist/
├── win-unpacked/                      ← Portable version
│   ├── FX Platform Executor.exe      ← Main executable
│   ├── resources/
│   │   ├── app.asar                  ← Application code
│   │   ├── libs/                     ← libzmq.dll
│   │   └── experts/                  ← FX_Platform_Bridge.ex5
│   └── ...
├── FX Platform Executor Setup 1.0.0.exe   ← NSIS Installer
└── FX Platform Executor 1.0.0.exe         ← Portable exe
```

## Icon File Requirements Summary

**REQUIRED**:
- Format: `.ico`
- Minimum size: 256x256 pixels
- Recommended: Multi-resolution (16, 32, 48, 64, 128, 256, 512)
- Expected file size: ~200KB+ (for multi-res)
- Current file size: 67KB ❌ (too small)

**UPDATE ICON**:
1. Create/convert new icon dengan tool
2. Copy ke: `resources/icons/icon.ico`
3. Verify size: `Get-Item "resources\icons\icon.ico"`
4. Run: `npm run package:win`

## Support & Debugging

Jika ada masalah:
1. Check console logs
2. Open DevTools (Ctrl+Shift+I)
3. Check file `logs/` folder
4. Verify all files in `dist/win-unpacked/resources/`

---

**STATUS**: Application is READY, waiting for proper icon to create installer package.
