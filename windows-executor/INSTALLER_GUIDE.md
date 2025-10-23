# FX Platform Executor - Single Installer Guide

## 🎯 Overview

Proyek ini menggunakan **NSIS (Nullsoft Scriptable Install System)** melalui electron-builder untuk membuat **SATU FILE INSTALLER EXE** yang berisi semua file aplikasi.

## ✅ Apa yang Anda Dapatkan

Setelah build, Anda akan mendapatkan **1 file** saja:

```
dist-electron/
└── FXPlatformExecutor-Setup-1.0.0.exe  (~100-200 MB)
```

**TIDAK ADA** file lain yang perlu di-zip atau di-bundle! ✅

## 📦 Isi Installer (Semua dalam 1 File EXE)

File installer berisi **SEMUA** yang dibutuhkan:

```
Compressed dalam Setup.exe:
├── FX Platform Executor.exe (main application)
├── electron/ (Electron runtime & main process)
├── dist/ (React frontend compiled)
├── node_modules/ (ALL dependencies)
│   ├── zeromq/ (with native .node modules)
│   ├── better-sqlite3/ (with native modules)
│   └── ... (all other dependencies)
├── resources/
│   ├── libs/
│   │   ├── libzmq-x64.dll (7.7 MB)
│   │   └── libzmq-x86.dll (optional)
│   ├── experts/
│   │   ├── FX_Platform_Bridge.mq5
│   │   └── FX_Platform_Bridge.ex5
│   └── icons/
│       └── icon.ico
└── package.json
```

**Total size compressed**: ~100-200 MB (tergantung dependencies)

## 🚀 Cara Build Installer

### 1. Persiapan

```bash
cd windows-executor

# Install dependencies
npm install

# Rebuild native modules untuk Electron
npm run rebuild

# Build React frontend
npm run build:react

# Build Electron main process
npm run build:electron
```

### 2. Build Installer

```bash
# Build installer untuk Windows
npm run package:win
```

### 3. Output

Setelah selesai (~2-5 menit), cek:

```bash
ls -lh dist-electron/

# Output:
# FXPlatformExecutor-Setup-1.0.0.exe  (150 MB)
# latest.yml (update metadata)
```

## 👤 Pengalaman User Saat Install

### Step 1: Download
User download **1 file** saja: `FXPlatformExecutor-Setup-1.0.0.exe`

### Step 2: Jalankan Installer
User double-click file exe

### Step 3: Wizard Installer

```
┌────────────────────────────────────────┐
│  FX Platform Executor Setup            │
│                                         │
│  Welcome to FX Platform Executor       │
│  Setup Wizard                           │
│                                         │
│  This will install FX Platform         │
│  Executor on your computer.            │
│                                         │
│         [Next >]    [Cancel]           │
└────────────────────────────────────────┘
```

### Step 4: Pilih Lokasi Install

```
┌────────────────────────────────────────┐
│  Choose Install Location               │
│                                         │
│  Setup will install to the following   │
│  location:                              │
│                                         │
│  C:\Program Files\FX Platform Executor │
│                                         │
│  [Browse...]                            │
│                                         │
│  Space required: 300 MB                │
│  Space available: 50 GB                │
│                                         │
│    [< Back]    [Install]   [Cancel]   │
└────────────────────────────────────────┘
```

### Step 5: Instalasi Berjalan

```
┌────────────────────────────────────────┐
│  Installing                             │
│                                         │
│  ████████████████░░░░░░░░░░░  65%      │
│                                         │
│  Extracting files...                   │
│  Creating shortcuts...                 │
│                                         │
└────────────────────────────────────────┘
```

### Step 6: Selesai!

```
┌────────────────────────────────────────┐
│  Completing FX Platform Executor       │
│  Setup Wizard                           │
│                                         │
│  ✓ Installation completed successfully │
│                                         │
│  □ Run FX Platform Executor            │
│  ✓ Create Desktop shortcut             │
│  ✓ Create Start Menu shortcut          │
│                                         │
│              [Finish]                   │
└────────────────────────────────────────┘
```

### Step 7: Hasil Instalasi

```
C:\Program Files\FX Platform Executor\
├── FX Platform Executor.exe
├── resources\
│   ├── app.asar (aplikasi compressed)
│   ├── app.asar.unpacked\ (native modules)
│   │   ├── node_modules\
│   │   │   ├── zeromq\
│   │   │   └── better-sqlite3\
│   │   └── resources\
│   │       ├── libs\libzmq-x64.dll
│   │       └── experts\*.mq5
│   └── resources\
│       ├── libs\
│       ├── experts\
│       └── icons\
├── locales\
├── resources.pak
└── ... (Electron runtime files)

C:\Users\[Username]\Desktop\
└── FX Platform Executor.lnk

C:\ProgramData\Microsoft\Windows\Start Menu\Programs\
└── FX Platform Executor.lnk
```

## 🔧 Konfigurasi Installer

### File: electron-builder.config.js

```javascript
nsis: {
  oneClick: false,              // ❌ Bukan one-click, ada wizard
  perMachine: false,            // Per-user installation
  allowElevation: true,         // Allow admin elevation jika perlu
  allowToChangeInstallationDirectory: true,  // ✅ User bisa pilih lokasi
  createDesktopShortcut: true,  // ✅ Buat shortcut di Desktop
  createStartMenuShortcut: true, // ✅ Buat shortcut di Start Menu
  shortcutName: "FX Platform Executor",
  installerIcon: "resources/icons/icon.ico",
  uninstallerIcon: "resources/icons/icon.ico",
  deleteAppDataOnUninstall: false,  // Keep user data saat uninstall
  artifactName: "${productName}-Setup-${version}.${ext}",
  runAfterFinish: true,         // ✅ Option to run setelah install
  menuCategory: true,           // Group in Start Menu folder
}
```

### File yang Di-bundle

```javascript
files: [
  "electron/**/*",           // Main process
  "dist/**/*",               // React frontend
  "node_modules/**/*",       // ALL dependencies
  "package.json",
  // Exclude unnecessary files
  "!node_modules/*/{CHANGELOG.md,README.md,readme.md}",
  "!node_modules/*/{test,tests,examples}",
  "!node_modules/*.d.ts",
  "!**/*.{map,md}",
],

extraResources: [
  {
    from: "resources",       // Your custom resources
    to: "resources",
    filter: ["**/*"],
  },
  {
    from: "node_modules/zeromq/build",
    to: "zeromq-build",
    filter: ["**/*.node"],
  },
],

asarUnpack: [
  "node_modules/zeromq/**/*",      // Native modules harus unpacked
  "node_modules/better-sqlite3/**/*",
  "resources/**/*",                 // Custom resources
],
```

## 📊 Perbandingan: ZIP vs Single Installer

### ❌ ZIP/RAR Method (OLD WAY)

```
download: my-app.zip (50 MB download)
└── extract: my-app\ (150 MB extracted)
    ├── FX Platform Executor.exe
    ├── resources\
    ├── node_modules\
    └── ... (banyak file)

User harus:
1. Download ZIP
2. Extract ZIP
3. Pindah folder ke Program Files (manual)
4. Buat shortcut (manual)
5. Risk: file hilang/pindah/corrupt
```

### ✅ Single Installer EXE (CURRENT - BEST!)

```
download: FXPlatformExecutor-Setup-1.0.0.exe (150 MB)

User cukup:
1. Download 1 file
2. Double-click
3. Next, Next, Install
4. Done! ✓

Benefits:
✓ Professional
✓ Easy untuk user
✓ Auto-create shortcuts
✓ Registered in Add/Remove Programs
✓ Proper uninstaller
✓ Update support
```

## 🎨 Customization (Optional)

### Custom Installer Images

Jika ingin custom installer appearance:

```bash
# Buat images:
resources/icons/
├── icon.ico (256x256)
├── installerHeader.bmp (150x57 pixels)
└── installerSidebar.bmp (164x314 pixels)
```

Update config:
```javascript
nsis: {
  installerHeader: "resources/icons/installerHeader.bmp",
  installerSidebar: "resources/icons/installerSidebar.bmp",
}
```

### Custom License

```bash
# Buat file LICENSE di root:
echo "License Agreement Text Here" > LICENSE
```

Config sudah include:
```javascript
nsis: {
  license: "LICENSE",  // ✓ Already configured
}
```

### Custom Install Location Default

```javascript
nsis: {
  // Default install location
  // Sudah otomatis: C:\Program Files\FX Platform Executor
  // Atau edit di package.json "name"
}
```

## 🧪 Testing Installer

### 1. Build Installer
```bash
npm run package:win
```

### 2. Test di Virtual Machine (Recommended)
- Install Windows VM (VirtualBox/VMware)
- Copy `FXPlatformExecutor-Setup-1.0.0.exe` ke VM
- Test instalasi dari awal

### 3. Test di Clean Windows
- Pastikan tidak ada dependencies pre-installed
- Hanya Windows + .NET Framework

### 4. Test Checklist
```
□ Installer runs without errors
□ Can choose custom install location
□ Desktop shortcut created
□ Start Menu shortcut created
□ Application launches successfully
□ All features work (MT5 detection, ZeroMQ, etc.)
□ Uninstaller works properly
□ Can reinstall after uninstall
```

## 📤 Distribution

### Upload ke Server/Cloud

```bash
# File untuk upload (1 file saja!):
dist-electron/FXPlatformExecutor-Setup-1.0.0.exe

# Upload ke:
- Website download page
- Google Drive
- Dropbox
- AWS S3
- GitHub Releases
- dll
```

### GitHub Releases (Recommended)

```bash
# Create release
git tag v1.0.0
git push origin v1.0.0

# Upload file di GitHub Releases page
# User download langsung dari GitHub
```

### Website Download

```html
<a href="/downloads/FXPlatformExecutor-Setup-1.0.0.exe" 
   download>
  Download FX Platform Executor (150 MB)
</a>
```

## 🔄 Updates

### Auto-Update Support

Installer sudah include `latest.yml` untuk auto-update:

```yaml
# dist-electron/latest.yml
version: 1.0.0
files:
  - url: FXPlatformExecutor-Setup-1.0.0.exe
    sha512: ...
    size: 157286400
path: FXPlatformExecutor-Setup-1.0.0.exe
sha512: ...
releaseDate: '2025-10-24T...'
```

Upload both files:
- `FXPlatformExecutor-Setup-1.0.0.exe`
- `latest.yml`

Aplikasi akan auto-check updates!

## 🐛 Troubleshooting

### Issue: "Build failed"

**Solution:**
```bash
# Clean dan rebuild
npm run clean
rm -rf node_modules
npm install
npm run rebuild
npm run build
npm run package:win
```

### Issue: "Missing libzmq-x64.dll"

**Solution:**
```bash
# Ensure DLL exists
npm run setup:libzmq

# Verify
ls -lh resources/libs/libzmq-x64.dll
```

### Issue: "Installer size too large"

**Solution:**
```javascript
// Edit electron-builder.config.js
files: [
  // Add more exclusions
  "!node_modules/**/test/**",
  "!node_modules/**/*.md",
  "!node_modules/**/*.map",
]
```

### Issue: "Application won't start after install"

**Causes:**
1. Missing native modules
2. Path issues
3. Permissions

**Solution:**
```javascript
// Ensure asarUnpack includes all native modules
asarUnpack: [
  "node_modules/zeromq/**/*",
  "node_modules/better-sqlite3/**/*",
  "resources/**/*",
]
```

## 📋 Checklist Sebelum Release

```
Build Preparation:
□ libzmq-x64.dll exists and valid (7.7 MB)
□ MT5 EA files (.mq5, .ex5) in resources/experts/
□ Icons prepared (icon.ico)
□ LICENSE file exists
□ package.json version updated

Build:
□ npm install completed
□ npm run rebuild completed
□ npm run build completed
□ npm run package:win completed
□ No errors in build output

Testing:
□ Installer runs on clean Windows
□ Installation completes successfully
□ Shortcuts created
□ Application launches
□ All features work
□ Uninstaller works
□ Can reinstall

Distribution:
□ Installer file ready (~150 MB)
□ latest.yml ready (for auto-update)
□ Upload to distribution platform
□ Download link tested
□ Installation guide for users
```

## 📚 Resources

- **Electron Builder Docs**: https://www.electron.build/
- **NSIS Documentation**: https://nsis.sourceforge.io/Docs/
- **Code Signing Guide**: https://www.electron.build/code-signing
- **Auto-Update Guide**: https://www.electron.build/auto-update

## 🎉 Summary

**Yang User Download**: 1 file EXE saja! ✅

**Yang User Lakukan**: 
1. Download
2. Double-click
3. Next, Next, Install
4. Done!

**Yang Anda Lakukan**:
```bash
npm run package:win
# Upload 1 file: FXPlatformExecutor-Setup-1.0.0.exe
```

**SEMUDAH ITU!** 🚀

---

**Last Updated**: 24 Oktober 2025  
**Build System**: electron-builder + NSIS  
**Installer Type**: Single EXE with wizard  
**Status**: Production Ready ✅