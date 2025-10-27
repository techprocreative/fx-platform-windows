# 🚀 Windows Executor V2 - Setup Guide

## Quick Setup (3 Steps Only!)

### Step 1: Copy Configuration File

```bash
cp .env.example .env
```

### Step 2: Edit .env File

**Open `.env` and fill in ONLY these 3 values:**

```env
# 1. Your API Key (from https://fx.nusanexus.com dashboard)
WE_V2_API_KEY=your_api_key_here

# 2. Your API Secret (from https://fx.nusanexus.com dashboard)
WE_V2_API_SECRET=your_api_secret_here

# 3. Unique Executor ID (choose any unique name)
WE_V2_EXECUTOR_ID=my_executor_001
```

**That's it!** ✅ You don't need to configure:
- ❌ Platform URL (hardcoded to https://fx.nusanexus.com)
- ❌ Pusher credentials (auto-fetched from platform)
- ❌ MT5 path (auto-detected)

### Step 3: Run the Executor

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
./start.sh
```

---

## 📝 Getting Your Credentials

### 1. Login to Platform
Go to: **https://fx.nusanexus.com**

### 2. Navigate to Executor Settings
Dashboard → Settings → Executor API

### 3. Generate Credentials
Click **"Generate API Key"** to get:
- API Key (copy this)
- API Secret (copy this - shown only once!)

### 4. Choose Executor ID
Pick a unique identifier for this executor, for example:
- `executor_001`
- `my_laptop_executor`
- `trading_pc_01`

---

## ✅ What Happens Automatically

### 1. MT5 Auto-Detection
Executor will automatically find MT5 installation from:
- Registry (recommended installation)
- Common installation paths:
  - `C:\Program Files\MetaTrader 5\`
  - `C:\Program Files (x86)\MetaTrader 5\`
  - AppData folders
  - Broker-specific installations (XM, Alpari, FBS, Exness, etc.)

**No manual configuration needed!**

### 2. Pusher Auto-Configuration
When executor starts with your API credentials, it will:
1. Connect to https://fx.nusanexus.com API
2. Fetch Pusher credentials automatically
3. Subscribe to your private command channel
4. Start listening for trading commands

**No Pusher credentials needed from you!**

### 3. Database Auto-Creation
SQLite database will be created automatically on first run.

---

## 🔧 Troubleshooting

### Problem: "API key not configured"
**Solution:** Make sure you filled `WE_V2_API_KEY` in `.env` file

### Problem: "Failed to fetch Pusher config"
**Solution:** 
- Check your API Key is correct
- Make sure you're connected to internet
- Verify https://fx.nusanexus.com is accessible

### Problem: "MT5 not found"
**Solution:** 
- Install MT5 from your broker
- Or specify path manually in `.env`:
  ```env
  WE_V2_MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe
  ```

### Problem: "Backend won't start"
**Solution:**
- Check if Python is installed: `python --version`
- Install dependencies: `cd backend && pip install -r requirements.txt`
- Check if port 8081 is free

---

## 🎯 Configuration Summary

| Setting | Required? | User Input? | Source |
|---------|-----------|-------------|--------|
| **API Key** | ✅ Yes | ✅ YES | Get from dashboard |
| **API Secret** | ✅ Yes | ✅ YES | Get from dashboard |
| **Executor ID** | ✅ Yes | ✅ YES | Choose any unique name |
| Platform URL | ✅ Yes | ❌ NO | Hardcoded: https://fx.nusanexus.com |
| Pusher Key | ✅ Yes | ❌ NO | Auto-fetched from API |
| Pusher Cluster | ✅ Yes | ❌ NO | Auto-fetched from API |
| Pusher Channel | ✅ Yes | ❌ NO | Auto-fetched from API |
| MT5 Path | ✅ Yes | ❌ NO | Auto-detected |

**User only configures: 3 values**  
**System auto-configures: Everything else**

---

## 📊 Startup Flow

```
1. User starts executor (start.bat)
   ↓
2. Load .env configuration
   ↓
3. Validate API Key + Secret + Executor ID
   ↓
4. Connect to https://fx.nusanexus.com/api/executor/config
   ↓
5. Fetch Pusher credentials automatically
   ↓
6. Auto-detect MT5 installation
   ↓
7. Initialize MT5 connection
   ↓
8. Subscribe to Pusher channel
   ↓
9. Start listening for trading commands
   ↓
10. Ready to execute strategies! ✅
```

---

## 🔐 Security Notes

1. **Never share your API Secret** - treat it like a password
2. **Platform URL is hardcoded** - prevents pointing to wrong server
3. **Pusher credentials are temporary** - refreshed on each startup
4. **All communication uses HTTPS** - encrypted by default

---

## 📞 Support

**Issues?** Check:
1. This guide first
2. README.md for detailed documentation
3. Platform support at https://fx.nusanexus.com/support

---

**Happy Trading! 🚀**
