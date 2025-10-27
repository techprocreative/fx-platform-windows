# 🏗️ Build Guide - Creating Installer Package

## Prerequisites

### Required Software
1. **Python 3.11+** - [Download](https://python.org)
2. **Node.js 18+** - [Download](https://nodejs.org)
3. **Git** - [Download](https://git-scm.com)

### Python Packages
```bash
cd backend
pip install -r requirements.txt
```

### Node Packages
```bash
cd frontend
npm install
```

---

## 🚀 Quick Build (Automated)

### Windows

```bash
# Run the automated build script
build-installer.bat
```

**This will:**
1. ✅ Check all prerequisites
2. ✅ Build Python backend with PyInstaller (standalone .exe)
3. ✅ Install frontend dependencies
4. ✅ Build Electron UI
5. ✅ Create Windows installer (.exe)
6. ✅ Open dist folder with result

**Output:** `dist/Windows Executor V2-Setup-1.0.0.exe`

---

## 📦 What Gets Packaged

### Included in Installer:
- ✅ **Electron UI** - Modern React interface
- ✅ **Python Backend** - Standalone executable (no Python installation needed!)
- ✅ **All Dependencies** - Bundled:
  - FastAPI, Uvicorn, Pydantic
  - MetaTrader5 Python API
  - TA-Lib (technical indicators)
  - SQLAlchemy (database)
  - All other Python packages
- ✅ **SQLite Database** - Auto-created on first run
- ✅ **Configuration Template** - .env.example
- ✅ **Documentation** - README and guides

### NOT Included (User Provides):
- ❌ Python installation (not needed - backend is standalone!)
- ❌ MT5 installation (user must install separately)
- ❌ API credentials (user configures after installation)

---

## 🔧 Manual Build Steps

If you need to build manually or customize:

### Step 1: Build Python Backend

```bash
cd backend

# Install PyInstaller if not already installed
pip install pyinstaller

# Build with PyInstaller
pyinstaller build-backend.spec --clean --noconfirm

# Backend executable will be in: dist/WindowsExecutorV2Backend/
```

### Step 2: Prepare Backend Distribution

```bash
# Copy backend to distribution folder
mkdir ..\backend-dist
xcopy /E /I /Y dist\WindowsExecutorV2Backend ..\backend-dist
```

### Step 3: Build Electron Frontend

```bash
cd ..\frontend

# Install dependencies
npm install

# Build React app and Electron
npm run build

# Create installer
npm run electron:build
```

### Step 4: Find Your Installer

```bash
cd ..\dist
# Installer: Windows Executor V2-Setup-1.0.0.exe
```

---

## 📊 Build Output Structure

```
dist/
├── Windows Executor V2-Setup-1.0.0.exe    # Main installer (distribute this!)
├── win-unpacked/                           # Unpacked files (for testing)
│   ├── Windows Executor V2.exe             # Electron app
│   ├── resources/
│   │   ├── app/                            # Frontend files
│   │   └── backend/                        # Python backend (standalone)
│   │       ├── WindowsExecutorV2Backend.exe
│   │       └── _internal/                  # Dependencies
│   └── locales/
└── builder-debug.yml                       # Build metadata
```

---

## 🎯 Installer Features

### NSIS Installer Configuration:
- ✅ **Custom Installation Directory** - User can choose where to install
- ✅ **Desktop Shortcut** - Quick access icon
- ✅ **Start Menu Shortcut** - Added to Windows Start Menu
- ✅ **Uninstaller** - Clean uninstall support
- ✅ **License Agreement** - Shows LICENSE.txt during installation
- ✅ **Progress Bar** - Shows installation progress
- ✅ **Administrator Privileges** - Requests elevation if needed

---

## 📏 Package Sizes

**Approximate sizes:**
- Backend (PyInstaller) - ~150 MB
- Frontend (Electron) - ~80 MB
- **Total Installer** - ~230 MB

**Why so large?**
- Python runtime embedded
- All Python packages bundled
- Electron/Chromium runtime
- Node modules bundled
- Complete independence from system Python

**Benefit:** Users don't need to install Python! ✅

---

## 🧪 Testing the Installer

### Before Distribution:

1. **Test on Clean VM**
   ```bash
   # Create Windows VM without:
   - Python installed
   - Node.js installed
   - Any development tools
   ```

2. **Run Installer**
   - Double-click `Windows Executor V2-Setup-1.0.0.exe`
   - Follow installation wizard
   - Choose installation directory
   - Wait for completion

3. **Verify Installation**
   - Check Desktop shortcut exists
   - Check Start Menu entry exists
   - Launch application
   - Verify UI opens

4. **Test Functionality**
   - Configure `.env` with test credentials
   - Start executor
   - Check MT5 connection
   - Verify backend starts
   - Test strategy execution

5. **Test Uninstall**
   - Use Windows "Add/Remove Programs"
   - Uninstall completely
   - Verify files are removed
   - Check no leftovers in Program Files

---

## 🔍 Troubleshooting Build Issues

### Issue: PyInstaller fails with "ModuleNotFoundError"

**Solution:**
```bash
# Add missing module to build-backend.spec
hiddenimports += ['missing_module_name']
```

### Issue: electron-builder fails

**Solution:**
```bash
# Clear node_modules and rebuild
cd frontend
rm -rf node_modules
npm install
npm run electron:build
```

### Issue: Installer size too large

**Solution:**
```bash
# Enable UPX compression in build-backend.spec
upx=True

# Or exclude unnecessary files in package.json
"files": [
  "!node_modules/.cache/**/*"
]
```

### Issue: Backend crashes on user machine

**Solution:**
```bash
# Test with PyInstaller debug mode
pyinstaller build-backend.spec --clean --noconfirm --debug all

# Check dependencies are included
pyi-archive_viewer dist/WindowsExecutorV2Backend.exe
```

---

## 📝 Build Checklist

Before releasing:

- [ ] Updated version in `frontend/package.json`
- [ ] Updated version in build scripts
- [ ] All tests pass (`pytest tests/`)
- [ ] Frontend builds without errors
- [ ] Backend builds without errors
- [ ] Installer creates successfully
- [ ] Tested on clean Windows VM
- [ ] LICENSE.txt is up to date
- [ ] README.md is current
- [ ] SETUP_GUIDE.md is accurate
- [ ] Icon files are present (icon.ico)
- [ ] Changelog/Release notes written

---

## 🚢 Distribution

### Upload Locations:
1. **GitHub Releases** - For public distribution
2. **Google Drive** - Direct download link
3. **Platform Dashboard** - Download from https://fx.nusanexus.com

### File Naming Convention:
```
Windows-Executor-V2-Setup-{version}.exe

Examples:
- Windows-Executor-V2-Setup-1.0.0.exe
- Windows-Executor-V2-Setup-1.1.0.exe
- Windows-Executor-V2-Setup-2.0.0-beta.exe
```

### Distribution Checklist:
- [ ] Signed with code signing certificate (optional but recommended)
- [ ] Virus scanned with multiple engines
- [ ] Checksums (SHA256) published
- [ ] Download links tested
- [ ] User documentation available
- [ ] Support channels ready

---

## 🔐 Code Signing (Optional but Recommended)

### Why Sign?
- ✅ Users won't see "Unknown Publisher" warning
- ✅ Windows SmartScreen won't block
- ✅ Builds trust with users

### How to Sign:

1. **Get Code Signing Certificate**
   - Purchase from: DigiCert, Sectigo, Comodo
   - Cost: ~$200-400/year

2. **Sign the Installer**
   ```bash
   # Using signtool (Windows SDK)
   signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com "dist/Windows Executor V2-Setup-1.0.0.exe"
   ```

3. **Verify Signature**
   ```bash
   signtool verify /pa "dist/Windows Executor V2-Setup-1.0.0.exe"
   ```

---

## 📈 Version Management

### Semantic Versioning:
- **Major** (1.x.x) - Breaking changes
- **Minor** (x.1.x) - New features (backward compatible)
- **Patch** (x.x.1) - Bug fixes

### Update Version:
```json
// frontend/package.json
{
  "version": "1.0.0"  // Update this
}
```

### Rebuild:
```bash
build-installer.bat
```

---

## ✅ Success Criteria

A successful build means:
1. ✅ Installer file created in `dist/` folder
2. ✅ Size is reasonable (~200-300 MB)
3. ✅ Installs on clean Windows machine
4. ✅ Application launches without errors
5. ✅ Backend connects to platform
6. ✅ MT5 connection works
7. ✅ All features functional
8. ✅ Uninstall works cleanly

---

## 🆘 Getting Help

**Build fails?**
1. Check build logs in console
2. Review error messages
3. Search GitHub Issues
4. Contact: dev@nusanexus.com

**Distribution issues?**
1. Verify file integrity (checksums)
2. Test on multiple Windows versions
3. Check antivirus false positives
4. Contact: support@nusanexus.com

---

**Ready to build? Run `build-installer.bat` and distribute!** 🚀
