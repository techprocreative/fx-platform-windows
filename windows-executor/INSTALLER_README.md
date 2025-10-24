# FX Platform Executor - Automated Installer

## 🚀 Quick Start

Jalankan salah satu dari:

### Windows (Recommended)
```cmd
setup-installer.bat
```
**atau** klik kanan `setup-installer.bat` → **Run as Administrator**

### PowerShell
```powershell
.\setup-installer.ps1
```

---

## 📦 Apa yang Akan Di-install?

Installer ini akan **otomatis**:

### 1. Detect MT5 Installations ✅
- Scan di `C:\Program Files\MetaTrader 5\`
- Scan di `C:\Program Files (x86)\MetaTrader 5\`
- Check Windows Registry untuk custom paths
- Scan di `%APPDATA%\MetaQuotes\Terminal`

### 2. Download & Install ZeroMQ ✅
- Download `libzmq.dll` (versi 4.3.4)
- Copy ke `MQL5/Libraries/` di setiap MT5 instance
- Backup file lama jika ada

### 3. Create Expert Advisor Files ✅
- Generate `FX_Platform_Bridge.mq5` (EA source code)
- Generate `Zmq.mqh` (ZeroMQ wrapper)
- Copy ke `MQL5/Experts/` dan `MQL5/Include/Zmq/`

### 4. Setup Resources Directory ✅
- Create `resources/` folder structure
- Store semua components untuk reference
- File structure:
  ```
  resources/
  ├── libs/
  │   └── libzmq.dll
  ├── experts/
  │   └── FX_Platform_Bridge.mq5
  └── includes/
      └── Zmq.mqh
  ```

### 5. Create Default Configuration ✅
- Generate config template di `%APPDATA%/fx-executor-config/config.json`
- Set default values
- Mark as first run

---

## 🔧 Advanced Usage

### Specify Custom MT5 Path
```powershell
.\setup-installer.ps1 -MT5Path "D:\MyMT5"
```

### Silent Mode (No pause)
```powershell
.\setup-installer.ps1 -Silent
```

### Both Combined
```powershell
.\setup-installer.ps1 -MT5Path "D:\MyMT5" -Silent
```

---

## ✅ Verification Checklist

Setelah installer selesai, verify:

### In MT5:
- [ ] File `FX_Platform_Bridge.mq5` ada di `MQL5/Experts/`
- [ ] File `Zmq.mqh` ada di `MQL5/Include/Zmq/`
- [ ] File `libzmq.dll` ada di `MQL5/Libraries/`

### In Application:
- [ ] Config file exists: `%APPDATA%/fx-executor-config/config.json`
- [ ] Resources folder populated: `resources/libs/libzmq.dll`

### MT5 Settings:
- [ ] AutoTrading is enabled
- [ ] DLL imports allowed: Tools → Options → Expert Advisors → "Allow DLL imports"

---

## 🔨 Manual Installation (if needed)

Jika automated installer gagal, manual steps:

### 1. Get ZeroMQ DLL
Download from: https://github.com/zeromq/libzmq/releases/tag/v4.3.4
Extract `libzmq.dll` (x64 version)

### 2. Copy Files to MT5
```
MT5 Installation/
└── MQL5/
    ├── Libraries/
    │   └── libzmq.dll          ← Copy here
    ├── Experts/
    │   └── FX_Platform_Bridge.mq5  ← Copy here
    └── Include/
        └── Zmq/
            └── Zmq.mqh          ← Copy here
```

### 3. Compile EA in MT5
1. Open MetaEditor (F4 in MT5)
2. Open `FX_Platform_Bridge.mq5`
3. Click Compile (F7)
4. Check for errors in Toolbox

### 4. Enable DLL Imports
1. Tools → Options → Expert Advisors
2. Check "Allow DLL imports"
3. Click OK

---

## 🐛 Troubleshooting

### "No MT5 installation found"
**Solution**: 
- Verify MT5 is installed
- Or specify path: `.\setup-installer.ps1 -MT5Path "C:\YourPath"`

### "Could not download ZeroMQ"
**Solution**:
- Check internet connection
- Or download manually from GitHub
- Place `libzmq.dll` in `resources/libs/`
- Re-run installer

### "Access Denied" when copying files
**Solution**:
- Run as Administrator
- Right-click `setup-installer.bat` → Run as Administrator

### MT5 can't load libzmq.dll
**Solution**:
- Make sure x64 version (not x86)
- Check MT5 is 64-bit version
- Enable DLL imports in MT5 settings
- Restart MT5 after copying files

### EA doesn't compile
**Solution**:
- Check `Zmq.mqh` is in correct location
- Verify libzmq.dll is in Libraries folder
- Check for syntax errors in MetaEditor

---

## 📋 Files Created by Installer

### Application Files
```
%APPDATA%/fx-executor-config/
└── config.json                  ← Default configuration

resources/
├── libs/
│   └── libzmq.dll              ← ZeroMQ library
├── experts/
│   └── FX_Platform_Bridge.mq5  ← EA source
└── includes/
    └── Zmq.mqh                 ← ZeroMQ wrapper
```

### MT5 Files (per installation)
```
MT5/MQL5/
├── Libraries/
│   └── libzmq.dll
├── Experts/
│   └── FX_Platform_Bridge.mq5
└── Include/Zmq/
    └── Zmq.mqh
```

---

## 🔄 Updating Components

To update components, simply:
1. Run installer again
2. It will overwrite old files
3. Restart MT5
4. Recompile EA if needed

---

## 🗑️ Uninstallation

To remove installed components:

### From MT5 (manual)
```powershell
# Remove from each MT5 installation
Remove-Item "C:\Program Files\MetaTrader 5\MQL5\Libraries\libzmq.dll"
Remove-Item "C:\Program Files\MetaTrader 5\MQL5\Experts\FX_Platform_Bridge.mq5"
Remove-Item "C:\Program Files\MetaTrader 5\MQL5\Include\Zmq" -Recurse
```

### From Application
```powershell
Remove-Item "$env:APPDATA\fx-executor-config" -Recurse
Remove-Item "$env:APPDATA\fx-executor" -Recurse
```

---

## 📞 Support

If installer fails:
1. Check logs in console output
2. Run with `-Verbose` for detailed logs
3. Check MT5 installation paths
4. Verify permissions (run as admin)
5. Try manual installation steps

---

## ✨ What's Next?

After successful installation:

1. **Open MT5** and verify files installed
2. **Compile EA** in MetaEditor (F7)
3. **Run FX Platform Executor** application
4. **Complete Setup Wizard** with your credentials
5. **Attach EA to chart** in MT5
6. **Start Trading!** 🚀
