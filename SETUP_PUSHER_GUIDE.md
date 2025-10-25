# 🚀 Pusher Setup Guide - Fix Command Delivery Issue

## ❌ Problem Identified
Commands stay in "pending" status because Pusher is not configured.

**Heartbeat works** because it uses HTTP API (`/api/executor/{id}/heartbeat`)  
**Commands don't work** because they use Pusher WebSocket (real-time push to executor)

---

## ✅ Solution: Setup Pusher (5 minutes)

### Step 1: Get Free Pusher Account

1. **Sign up**: https://dashboard.pusher.com/accounts/sign_up
   - Use Google/GitHub sign-in for fastest setup
   
2. **Create new Channels app**:
   - Click "Create app"
   - **App name**: `fx-platform-executor`
   - **Cluster**: Select closest to you
     - Asia Pacific: **ap1**
     - US East: **us2**
     - EU: **eu**
   - **Front-end tech**: React
   - **Back-end tech**: Node.js
   - Click "Create app"

3. **Get credentials**:
   - Go to "App Keys" tab
   - You'll see 4 values:
     ```
     app_id: 1234567
     key: abcdef123456
     secret: 7890abcdef
     cluster: ap1
     ```

---

### Step 2: Create `.env.local` File

Copy `.env.example` to `.env.local`:

```bash
# Windows Command Prompt
copy .env.example .env.local

# PowerShell
Copy-Item .env.example .env.local
```

Then edit `D:\fx-platform-windows-fresh\.env.local` and update these lines:

```env
# Pusher Configuration (REQUIRED for executor commands)
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key-here
NEXT_PUBLIC_PUSHER_CLUSTER=ap1
PUSHER_APP_ID=your-app-id-here
PUSHER_SECRET=your-pusher-secret-here

# Database (if not set)
DATABASE_URL="postgresql://username:password@localhost:5432/fx_platform"

# JWT Secret (generate random string)
JWT_SECRET=generate-a-random-32-character-string-here

# Site URL (for development)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**⚠️ Important**: Replace placeholder values with your actual Pusher credentials!

---

### Step 3: Create Executor Config

Create file: `D:\fx-platform-windows-fresh\windows-executor\config\executor-config.json`

```json
{
  "executorId": "cmh4h3aqj0001py6nb05dvjpk",
  "apiKey": "your-executor-api-key",
  "apiSecret": "your-executor-api-secret",
  "platformUrl": "http://localhost:3000",
  "pusherKey": "same-as-NEXT_PUBLIC_PUSHER_KEY",
  "pusherCluster": "ap1",
  "zmqPort": 5555,
  "zmqHost": "tcp://localhost",
  "heartbeatInterval": 60,
  "autoReconnect": true
}
```

**How to get `executorId`, `apiKey`, and `apiSecret`:**

1. Go to web platform: http://localhost:3000/dashboard/executors
2. Click on your executor name
3. Copy the executor ID from URL (e.g., `/executors/cmh4h3aqj0001py6nb05dvjpk`)
4. API Key and Secret were shown when you created the executor (only shown once!)
5. If you lost them, you need to create a new executor or regenerate credentials

---

### Step 4: Restart Everything

```bash
# Terminal 1: Restart web platform
npm run dev

# Terminal 2: Restart Windows Executor
# Close and reopen the executor application
```

---

### Step 5: Verify Setup

#### A. Check Pusher Config API
Open browser console and run:
```javascript
fetch('/api/debug/pusher-test')
  .then(r => r.json())
  .then(console.log)
```

**Expected output:**
```json
{
  "success": true,
  "pusher": {
    "configured": true,
    "appId": "✅ Set",
    "key": "✅ Set",
    "secret": "✅ Set",
    "cluster": "ap1"
  }
}
```

#### B. Check Executor Logs
In Windows Executor console, look for:
```
[INFO] Connecting to Pusher...
[INFO] Successfully subscribed to channel: private-executor-cmh4h3aqj0001py6nb05dvjpk
[INFO] Pusher connection established successfully
```

**If you see error:**
```
[ERROR] Channel subscription error
[ERROR] pusher:subscription_error: Status 403
```
→ Check that `apiKey` and `apiSecret` in executor-config.json are correct!

#### C. Test Manual Command
In browser console:
```javascript
fetch('/api/debug/pusher-test', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({executorId: 'cmh4h3aqj0001py6nb05dvjpk'})
})
.then(r => r.json())
.then(console.log)
```

**Check executor log** - should see:
```
[INFO] Command received: GET_STATUS
```

#### D. Test Strategy Activation
1. Go to Strategies page
2. Click "Activate" on a strategy
3. **Web platform log** should show:
   ```
   ✅ Command sent to executor xxx
   ```
4. **Executor log** should show:
   ```
   [INFO] Command received: START_STRATEGY
   ```
5. **Database** - command status should change: `pending` → `executed`

---

## 🎉 Success Checklist

- [ ] Pusher account created
- [ ] `.env.local` file created with Pusher credentials
- [ ] `executor-config.json` file created with correct values
- [ ] Web platform restarted
- [ ] Windows Executor restarted
- [ ] Executor log shows "Successfully subscribed to channel"
- [ ] Manual test command works
- [ ] Strategy activation works
- [ ] Command status changes from pending to executed

---

## 🐛 Troubleshooting

### Issue: "Pusher not configured" in logs
**Fix**: Check `.env.local` has all 4 Pusher variables set

### Issue: "Channel subscription error: 403"
**Fix**: 
1. Check `apiKey` and `apiSecret` in executor-config.json
2. Make sure they match the executor in database
3. Try creating a new executor if credentials are lost

### Issue: Commands sent but not received
**Fix**:
1. Check executor is running
2. Check `platformUrl` in executor-config.json is correct
3. Check firewall not blocking port 443 (Pusher uses WSS)
4. Try different Pusher cluster (us2, eu, ap1)

### Issue: "executorId not found"
**Fix**: 
1. Go to web platform executors page
2. Copy the correct executor ID from URL or table
3. Update executor-config.json

---

## 📚 Additional Resources

- Pusher Channels Docs: https://pusher.com/docs/channels/
- Pusher Debug Console: https://dashboard.pusher.com (see real-time events)
- Free tier limits: 200k messages/day, 100 concurrent connections

---

## 🔐 Security Notes

- ✅ `.env.local` is in `.gitignore` - secrets won't be committed
- ✅ `executor-config.json` should also be in `.gitignore`
- ✅ Never share Pusher secret key publicly
- ✅ Use different Pusher apps for dev/staging/production
- ✅ Rotate API keys if compromised

---

## Next Steps After Setup

1. Test all commands (START, STOP, PAUSE, RESUME)
2. Monitor Pusher dashboard for usage
3. Setup production Pusher app when deploying
4. Configure environment variables in Vercel/hosting platform
