# 📋 Log Files Location

## 📂 **Where to Find Logs**

### **Production (Installed App)**
```
C:\Users\[YourUsername]\AppData\Roaming\fx-platform-executor\logs\
```

### **Development Mode**
```
D:\fx-platform-windows-fresh\windows-executor\logs\
```

---

## 📝 **Log Files**

| File | Purpose | Max Size | Max Files | When to Check |
|------|---------|----------|-----------|---------------|
| **error.log** | All errors only | 5MB | 10 | When app crashes or errors occur |
| **combined.log** | All logs (info, warn, error) | 5MB | 10 | For general troubleshooting |
| **security.log** | Security events & warnings | 5MB | 20 | For security audits |
| **trading.log** | Trading operations & signals | 5MB | 20 | For strategy debugging |
| **performance.log** | Performance metrics | 5MB | 5 | For optimization |
| **exceptions.log** | Uncaught exceptions | 5MB | 10 | **CHECK FIRST when app crashes** |
| **rejections.log** | Unhandled promise rejections | 5MB | 10 | When async operations fail |

---

## 🚨 **Quick Debug Guide**

### **Scenario 1: App Crashes**
**Check in this order:**
1. ✅ `exceptions.log` - Uncaught exceptions
2. ✅ `error.log` - All errors
3. ✅ `combined.log` - Full context

### **Scenario 2: Strategy Activation/Deactivation Fails**
**Check:**
1. ✅ `combined.log` - Search for `COMMAND`
2. ✅ `error.log` - Look for strategy errors
3. ✅ `trading.log` - Strategy operations

### **Scenario 3: Connection Issues**
**Check:**
1. ✅ `combined.log` - Search for `CONNECTION`
2. ✅ `error.log` - Connection errors
3. ✅ `security.log` - Auth issues

### **Scenario 4: Trading Issues**
**Check:**
1. ✅ `trading.log` - All trading operations
2. ✅ `error.log` - Trade execution errors
3. ✅ `combined.log` - Full context

---

## 🔍 **How to Read Logs**

### **Log Format (JSON)**
```json
{
  "timestamp": "2025-10-25 14:30:15",
  "level": "ERROR",
  "message": "[MainController] Failed to execute strategy command: Missing strategyId",
  "category": "COMMAND",
  "metadata": {
    "command": "STOP_STRATEGY",
    "commandId": "cmd_xxx",
    "strategyId": null,
    "error": "Missing strategyId",
    "stack": "Error: Missing strategyId\n    at MainController...."
  },
  "service": "fx-executor",
  "version": "1.0.0",
  "pid": 12345
}
```

### **Key Fields:**
- **timestamp**: When error occurred
- **level**: ERROR, WARN, INFO, DEBUG
- **message**: What happened
- **category**: Which module (COMMAND, MAIN, CONNECTION, etc.)
- **metadata**: Additional details (command, strategyId, stack trace, etc.)
- **stack**: Full error stack trace

---

## 🛠️ **Opening Logs**

### **Method 1: File Explorer**
1. Press `Win + R`
2. Type: `%APPDATA%\fx-platform-executor\logs`
3. Press Enter

### **Method 2: Command Prompt**
```cmd
cd %APPDATA%\fx-platform-executor\logs
dir
notepad error.log
```

### **Method 3: PowerShell**
```powershell
cd $env:APPDATA\fx-platform-executor\logs
Get-ChildItem
code error.log  # Opens in VS Code
```

### **Method 4: View in Real-Time**
```powershell
Get-Content error.log -Wait -Tail 50
```

---

## 🔄 **Log Rotation**

Logs automatically rotate when:
- ✅ File size exceeds **5MB**
- ✅ Older than **30 days**
- ✅ Total files exceed **maxFiles** limit

**Rotated files format:** `error.log.1`, `error.log.2`, etc.

---

## 📊 **Log Levels**

| Level | Purpose | Example |
|-------|---------|---------|
| **ERROR** | Something failed | `Failed to execute command` |
| **WARN** | Potential issue | `Strategy not found in active list` |
| **INFO** | Normal operation | `Strategy activated successfully` |
| **DEBUG** | Detailed info | `Command received: START_STRATEGY` |

---

## 💡 **Tips**

### **1. Search for Specific Error**
```powershell
Select-String -Path combined.log -Pattern "Failed to execute"
```

### **2. View Last 100 Lines**
```powershell
Get-Content error.log -Tail 100
```

### **3. Filter by Category**
```powershell
Select-String -Path combined.log -Pattern "COMMAND"
```

### **4. View Logs by Time Range**
```powershell
Get-Content combined.log | Select-String "2025-10-25 14:3"
```

### **5. Export Recent Errors**
```powershell
Get-Content error.log -Tail 500 | Out-File recent_errors.txt
```

---

## 🐛 **Debug Workflow**

### **When Reporting Bugs:**
1. ✅ Copy **relevant log entries** (not entire file)
2. ✅ Include **timestamp** of issue
3. ✅ Include **error message** and **stack trace**
4. ✅ Include **metadata** (commandId, strategyId, etc.)

### **Example Bug Report:**
```
**Issue**: App crashed when deactivating strategy

**Timestamp**: 2025-10-25 14:30:15

**Error from exceptions.log**:
{
  "timestamp": "2025-10-25 14:30:15",
  "level": "ERROR",
  "message": "[MainController] UNCAUGHT EXCEPTION: Cannot read property 'id' of undefined",
  "category": "CRITICAL",
  "metadata": {
    "error": "Cannot read property 'id' of undefined",
    "stack": "TypeError: Cannot read property 'id' of undefined\n    at MainController.handleStopStrategy (main-controller.ts:465:45)\n    ...",
    "timestamp": "2025-10-25T14:30:15.123Z"
  }
}
```

---

## 🔐 **Log Security**

- ✅ Logs stored in **user directory** (not Program Files)
- ✅ **No sensitive data** logged (API keys, secrets masked)
- ✅ Automatic **cleanup** of old logs
- ✅ **Read-only** access for normal users

---

## 📞 **Need Help?**

If logs don't exist or you can't find them:
1. Check if executor is running
2. Verify installation directory
3. Check permissions on `%APPDATA%` folder
4. Contact support with system info

---

**Last Updated**: October 25, 2025  
**Executor Version**: 1.0.0
