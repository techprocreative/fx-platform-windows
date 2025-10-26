# 🔄 Clear Windows Executor Configuration

**Purpose**: Reset Windows Executor untuk fresh start dengan shared secret field yang baru

---

## 🎯 **WHY CLEAR CONFIG?**

Setelah update ke beta implementation, ada field baru:
- ✅ **sharedSecret** - Untuk EA authentication

Config lama tidak punya field ini, jadi perlu reset untuk fresh start.

---

## 📍 **CONFIG LOCATION**

Windows Executor menyimpan config di:

### **Option 1: LocalStorage (Browser-based)**
```
Key: "executor-config"
Location: Browser LocalStorage
```

### **Option 2: Electron Store (File-based)**
```
Windows: %APPDATA%\fx-platform-executor\config.json
Linux: ~/.config/fx-platform-executor/config.json
Mac: ~/Library/Application Support/fx-platform-executor/config.json
```

### **Option 3: Zustand Persist Storage**
```
Depends on storage adapter used
Check: localStorage or IndexedDB
```

---

## 🧹 **METHOD 1: CLEAR VIA APP (RECOMMENDED)**

### **Step 1: Open DevTools**
1. Launch Windows Executor
2. Press: **`Ctrl + Shift + I`** (Windows/Linux) or **`Cmd + Option + I`** (Mac)
3. Go to **Console** tab

### **Step 2: Run Clear Command**
```javascript
// Clear localStorage
localStorage.removeItem('executor-config');

// Or clear all localStorage
localStorage.clear();

// Reload app
location.reload();
```

### **Step 3: Verify**
```javascript
// Check if cleared
localStorage.getItem('executor-config'); // Should return null
```

---

## 🧹 **METHOD 2: CLEAR VIA FILE SYSTEM**

### **Windows**
```powershell
# Delete config file
Remove-Item "$env:APPDATA\fx-platform-executor\*" -Recurse -Force

# Or delete specific config
Remove-Item "$env:APPDATA\fx-platform-executor\config.json" -Force
```

### **Alternative: AppData Path**
```
%LOCALAPPDATA%\fx-platform-executor\
%APPDATA%\fx-platform-executor\
```

---

## 🧹 **METHOD 3: RESET VIA SETTINGS UI**

### **If Reset Button Available:**
1. Open Windows Executor
2. Go to **Settings** page
3. Scroll to bottom
4. Click **"Reset Configuration"** or **"Clear All Data"**
5. Confirm reset
6. Restart application

---

## 🧹 **METHOD 4: MANUAL DELETE DATABASE**

Windows Executor also stores data in SQLite:

```powershell
# Find database file
Get-ChildItem -Path "$env:APPDATA\fx-platform-executor" -Recurse -Filter "*.db"

# Delete database
Remove-Item "$env:APPDATA\fx-platform-executor\executor.db" -Force
```

---

## 🔧 **PROGRAMMATIC RESET**

### **Add Reset Script to Package.json**

Add to `windows-executor/package.json`:

```json
{
  "scripts": {
    "clear:config": "node scripts/clear-config.js"
  }
}
```

### **Create Script File**

Create `windows-executor/scripts/clear-config.js`:

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

const configPaths = [
  // Windows
  path.join(os.homedir(), 'AppData', 'Roaming', 'fx-platform-executor'),
  path.join(os.homedir(), 'AppData', 'Local', 'fx-platform-executor'),
  
  // Linux
  path.join(os.homedir(), '.config', 'fx-platform-executor'),
  
  // Mac
  path.join(os.homedir(), 'Library', 'Application Support', 'fx-platform-executor'),
];

console.log('🔄 Clearing Windows Executor configuration...\n');

configPaths.forEach(configPath => {
  if (fs.existsSync(configPath)) {
    console.log(`📁 Found: ${configPath}`);
    
    try {
      fs.rmSync(configPath, { recursive: true, force: true });
      console.log('✅ Deleted\n');
    } catch (error) {
      console.log(`❌ Failed to delete: ${error.message}\n`);
    }
  } else {
    console.log(`⏭️  Not found: ${configPath}\n`);
  }
});

console.log('✨ Configuration clear complete!');
console.log('ℹ️  Next launch will start fresh.\n');
```

### **Run Script**

```bash
cd windows-executor
npm run clear:config
```

---

## 📝 **QUICK COMMANDS**

### **PowerShell (Run as Administrator)**

```powershell
# Quick clear - delete all config
$paths = @(
  "$env:APPDATA\fx-platform-executor",
  "$env:LOCALAPPDATA\fx-platform-executor"
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Write-Host "🗑️ Deleting: $path"
    Remove-Item $path -Recurse -Force
  }
}

Write-Host "✅ Config cleared!"
```

### **CMD (Run as Administrator)**

```cmd
@echo off
echo Clearing FX Platform Executor configuration...

rd /s /q "%APPDATA%\fx-platform-executor" 2>nul
rd /s /q "%LOCALAPPDATA%\fx-platform-executor" 2>nul

echo Done!
pause
```

---

## 🔍 **VERIFY CLEAR SUCCESS**

After clearing, verify by:

### **1. Check File System**
```powershell
# Should return nothing
Test-Path "$env:APPDATA\fx-platform-executor"  # False
Test-Path "$env:LOCALAPPDATA\fx-platform-executor"  # False
```

### **2. Launch App**
- Open Windows Executor
- Should see **Setup Wizard** or **First Time Setup**
- Config fields should be empty

### **3. Check DevTools Console**
```javascript
localStorage.getItem('executor-config')  // null
```

---

## 🆕 **FRESH START SETUP**

After clearing config:

### **1. Launch Windows Executor**
```bash
cd windows-executor
npm start
```

### **2. Go to Settings**
Enter credentials from web platform:
- **API Key**: `exe_xxxxx`
- **API Secret**: `xxxxx`
- **Shared Secret**: `xxxxx` ← NEW FIELD

### **3. Save & Connect**
- Click "Save Configuration"
- Click "Connect"
- Verify connection status

---

## ⚠️ **IMPORTANT NOTES**

### **Data Loss Warning**
Clearing config will DELETE:
- ✅ API credentials
- ✅ Connection settings
- ✅ User preferences
- ✅ Cached data
- ⚠️ **Local database** (if clearing DB files)

### **What's NOT Deleted**
- ✅ Application files
- ✅ Downloaded strategies (on platform)
- ✅ Trade history (on platform/broker)
- ✅ Audit logs (on platform database)

### **Backup Before Clear**
```powershell
# Backup config
Copy-Item "$env:APPDATA\fx-platform-executor" "$env:USERPROFILE\Desktop\executor-backup" -Recurse
```

---

## 🔐 **SECURITY REMINDER**

After fresh start:
1. Get NEW credentials from web platform
2. Don't reuse old credentials
3. Shared secret is shown ONE TIME ONLY
4. Save credentials securely

---

## 🐛 **TROUBLESHOOTING**

### **Config Not Clearing**
```powershell
# Force close app first
taskkill /F /IM "fx-platform-executor.exe"

# Then delete
Remove-Item "$env:APPDATA\fx-platform-executor" -Recurse -Force
```

### **Permission Denied**
- Run PowerShell/CMD as Administrator
- Close Windows Executor before deleting

### **Config Keeps Coming Back**
- Check if app is still running
- Delete from BOTH AppData locations:
  - `%APPDATA%`
  - `%LOCALAPPDATA%`

---

## ✅ **VERIFICATION CHECKLIST**

After clearing and restarting:

- [ ] App shows setup wizard or empty settings
- [ ] No old credentials visible
- [ ] Can enter new API Key
- [ ] Can enter new API Secret  
- [ ] Can enter new Shared Secret ← NEW
- [ ] Connection works with new credentials
- [ ] No errors in console

---

## 🎯 **SUMMARY**

**Fastest Method**: 
```powershell
Remove-Item "$env:APPDATA\fx-platform-executor" -Recurse -Force
```

**Safest Method**: Use DevTools Console
```javascript
localStorage.removeItem('executor-config');
location.reload();
```

**Complete Reset**: Delete both AppData folders + restart

---

**Ready for fresh start with shared secret support! 🚀**
