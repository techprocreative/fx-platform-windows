# 📦 Windows Executor V2 - User Installation Guide

## 🎯 For End Users (Super Simple!)

### What You Need

1. ✅ **Windows 10/11** (64-bit)
2. ✅ **MetaTrader 5** - [Download from your broker](https://www.metatrader5.com)
3. ✅ **API Credentials** - Get from https://fx.nusanexus.com dashboard
4. ✅ **5 minutes** of your time!

**You DO NOT need:**
- ❌ Python installed
- ❌ Node.js installed
- ❌ Any programming knowledge
- ❌ Technical skills

---

## 📥 Step 1: Download Installer

### Option A: Platform Dashboard (Recommended)
1. Login to https://fx.nusanexus.com
2. Go to **Dashboard** → **Executors**
3. Click **"Download Windows Executor V2"**
4. Save file: `Windows Executor V2-Setup-1.0.0.exe`

### Option B: Direct Download
- [Download Link will be provided]
- File size: ~230 MB

---

## 🔧 Step 2: Install Application

1. **Run Installer**
   - Double-click `Windows Executor V2-Setup-1.0.0.exe`
   - If Windows asks "Do you want to allow this app?", click **Yes**

2. **Follow Installation Wizard**
   - Click **Next**
   - Read and accept License Agreement
   - Choose installation folder (default is fine: `C:\Program Files\Windows Executor V2`)
   - Click **Install**
   - Wait ~2 minutes

3. **Complete Installation**
   - Click **Finish**
   - Desktop shortcut will be created ✅
   - Start Menu entry will be added ✅

---

## 🔑 Step 3: Get Your API Credentials

1. **Login to Platform**
   - Go to https://fx.nusanexus.com
   - Login with your account

2. **Generate API Credentials**
   - Dashboard → Settings → **Executor API**
   - Click **"Generate New API Key"**
   - **Copy your credentials:**
     - ✅ API Key: `sk_xxxxxxxxxxxxxxxx`
     - ✅ API Secret: `sec_xxxxxxxxxxxxxxxxx` (shown once!)

3. **Save Securely**
   - Save credentials in a secure place
   - You'll need them in next step

---

## ⚙️ Step 4: Configure Executor (Super Easy!)

1. **Open Installation Folder**
   - Right-click desktop icon → **Open File Location**
   - Or navigate to: `C:\Program Files\Windows Executor V2`

2. **Edit Configuration File**
   - Find file: `.env.example`
   - **Copy it** and rename to: `.env`
   - Open `.env` with Notepad

3. **Fill in ONLY 3 Values:**

```env
# 1. Your API Key (from step 3)
WE_V2_API_KEY=sk_your_api_key_here

# 2. Your API Secret (from step 3)
WE_V2_API_SECRET=sec_your_api_secret_here

# 3. Unique Executor ID (choose any name you like)
WE_V2_EXECUTOR_ID=my_laptop_executor
```

**Examples of Executor ID:**
- `my_laptop`
- `trading_pc_01`
- `home_executor`
- `office_computer`

4. **Save File**
   - File → Save
   - Close Notepad

**That's it!** Everything else is automatic! ✅

---

## 🚀 Step 5: Start Executor

### Method 1: Desktop Shortcut (Easiest)
- Double-click **"Windows Executor V2"** icon on desktop

### Method 2: Start Menu
- Windows Start Menu → **"Windows Executor V2"**

### What Happens:
1. ✅ Backend starts automatically
2. ✅ Connects to https://fx.nusanexus.com
3. ✅ Fetches Pusher credentials automatically
4. ✅ Detects your MT5 installation
5. ✅ UI window opens
6. ✅ Ready to trade!

**First start may take 10-20 seconds**

---

## 🎨 Step 6: Using the Application

### Main Window Shows:

1. **Account Information**
   - Balance
   - Equity
   - Free Margin
   - Margin Level
   - Open Positions

2. **Active Strategies**
   - Strategies sent from web platform
   - Status: Active/Stopped
   - Trade count
   - Stop button

3. **Open Positions**
   - All your MT5 trades
   - Live profit/loss
   - Entry prices
   - Current prices

### How to Use:

1. **Activate Strategies on Web Platform**
   - Go to https://fx.nusanexus.com
   - Dashboard → Strategies
   - Assign strategy to this executor
   - Click **"Start Strategy"**

2. **Executor Receives Command**
   - Automatically via Pusher WebSocket
   - No action needed from you!

3. **Trades Execute Automatically**
   - When strategy conditions met
   - Appears in UI immediately
   - Visible in MT5 terminal

4. **Monitor in Real-Time**
   - Watch UI for updates
   - Check MT5 for positions
   - View web dashboard for history

---

## 🔍 Troubleshooting

### Problem: "MT5 not found"

**Solution:**
1. Install MetaTrader 5 from your broker
2. Or edit `.env` and add:
   ```env
   WE_V2_MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe
   ```

### Problem: "Backend won't start"

**Solution:**
1. Check `.env` file exists (not `.env.example`)
2. Verify API credentials are filled in
3. Check internet connection
4. Restart executor

### Problem: "Connection failed to platform"

**Solution:**
1. Check your API Key is correct
2. Verify internet connection
3. Check https://fx.nusanexus.com is accessible
4. Wait 1 minute and try again

### Problem: "No strategies showing"

**Solution:**
1. Login to web platform
2. Assign strategies to this executor
3. Click "Start Strategy"
4. Wait 10 seconds for sync

### Problem: Windows Defender blocks installer

**Solution:**
1. Click **"More info"**
2. Click **"Run anyway"**
3. This is normal for new software
4. Installer is safe (will be code-signed in future releases)

---

## 🔄 Updating to New Version

1. **Download New Installer**
   - Get latest version from platform

2. **Run New Installer**
   - It will detect existing installation
   - Choose **"Update"** or **"Install over"**

3. **Your Configuration Preserved**
   - `.env` file is kept
   - Database is kept
   - No need to reconfigure!

4. **Restart Executor**
   - Close old version
   - Start new version
   - Check version in UI

---

## 🗑️ Uninstalling

1. **Windows Settings**
   - Settings → Apps → Installed Apps
   - Find **"Windows Executor V2"**
   - Click **"Uninstall"**

2. **Or Use Control Panel**
   - Control Panel → Programs and Features
   - Select **"Windows Executor V2"**
   - Click **"Uninstall"**

3. **Clean Uninstall**
   - All files removed
   - Shortcuts removed
   - Database kept (in user folder) - can delete manually if needed

---

## 📊 System Requirements

### Minimum:
- Windows 10 (64-bit)
- 4 GB RAM
- 500 MB disk space
- Internet connection
- MetaTrader 5 installed

### Recommended:
- Windows 11 (64-bit)
- 8 GB RAM
- 1 GB disk space
- Stable broadband connection
- SSD drive

---

## 🔐 Security Best Practices

1. **Keep API Secret Secure**
   - Never share with anyone
   - Don't post in screenshots
   - Don't commit to GitHub

2. **Use Strong Passwords**
   - For platform account
   - For MT5 account

3. **Update Regularly**
   - Check for executor updates
   - Update when available

4. **Monitor Your Account**
   - Check trades regularly
   - Review logs
   - Watch for unusual activity

---

## 📞 Getting Help

### Support Channels:

1. **Platform Support**
   - Email: support@nusanexus.com
   - Live Chat: https://fx.nusanexus.com/support

2. **Documentation**
   - User Guide: https://fx.nusanexus.com/docs
   - FAQ: https://fx.nusanexus.com/faq
   - Video Tutorials: Coming soon!

3. **Community**
   - Discord: [Link will be provided]
   - Telegram: [Link will be provided]

---

## ✅ Installation Checklist

After installation, verify:

- [ ] Desktop shortcut exists
- [ ] Executor opens when clicked
- [ ] Backend status shows "OK" (green)
- [ ] Account information displays
- [ ] MT5 connection shows connected
- [ ] Strategies can be started from web platform
- [ ] Trades execute when conditions met
- [ ] Positions show in UI

**All checked?** You're ready to trade! 🚀

---

## 🎉 Success!

**You've successfully installed Windows Executor V2!**

Next steps:
1. Create strategies on web platform
2. Assign them to this executor
3. Start automated trading
4. Monitor and profit! 💰

**Happy Trading!** 🚀

---

## 📝 Quick Reference

| Task | How To |
|------|--------|
| **Start Executor** | Double-click desktop icon |
| **Stop Executor** | Close window or File → Exit |
| **View Logs** | Installation folder → logs/ |
| **Edit Config** | Installation folder → .env |
| **Update Version** | Run new installer |
| **Uninstall** | Windows Settings → Apps |
| **Get Support** | support@nusanexus.com |

---

**Questions? Contact: support@nusanexus.com** 📧
