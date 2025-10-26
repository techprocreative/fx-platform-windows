# 🚀 Quick Start Guide - Beta Testing

**For**: Developers & Testers  
**Estimated Time**: 30 minutes setup

---

## ⚡ **FAST TRACK SETUP**

### **1. Database** (Already Done ✅)
Database is already migrated and live. No action needed.

### **2. Environment Variables**
File `.env` is already configured. Verify:
```bash
cat .env
# Should show DATABASE_URL and BETA_MODE=true
```

### **3. Web Platform**
```bash
# Install dependencies (if not done)
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

Platform should start at: http://localhost:3000

### **4. Create Test Executor**
1. Go to http://localhost:3000/dashboard/executors
2. Click "Add New Executor"
3. Enter name: "Test Executor 1"
4. Select: MT5
5. Click "Create"
6. **SAVE ALL 3 CREDENTIALS**:
   - API Key: `exe_xxxxx`
   - Secret Key: `xxxxx`
   - Shared Secret: `xxxxx` ← For EA

### **5. Windows Executor**

#### Build & Run:
```bash
cd windows-executor

# Install dependencies
npm install

# Build
npm run build

# Start
npm start
```

#### Configure:
1. Open Windows Executor
2. Go to Settings
3. Enter:
   - API Key: (from step 4)
   - Secret Key: (from step 4)
   - Shared Secret: (from step 4) ← Optional for now
4. Click "Save"
5. Verify connection ✅

### **6. MT5 EA**

#### Compile:
1. Open MetaEditor
2. Open: `windows-executor/resources/experts/FX_NusaNexus_Beta.mq5`
3. Click Compile (F7)
4. Check for errors (should be 0)

#### Install:
1. Copy compiled `.ex5` file to MT5 `MQL5/Experts/` folder
2. Refresh Navigator in MT5 (F5)
3. Drag EA to any chart

#### Configure:
In EA settings:
- InpPushAddress: `tcp://127.0.0.1:5555` (default)
- InpReplyAddress: `tcp://127.0.0.1:5556` (default)
- **InpSharedSecret**: `xxxxx` ← Paste from step 4
- Click OK

#### Verify:
Check MT5 Experts tab:
- ✅ "Shared secret configured: 32 characters"
- ✅ "PUSH connection established"
- ✅ "REPLY connection bound"

---

## 🧪 **QUICK TESTS**

### Test 1: Authentication (5 min)
```bash
# In Windows Executor, send test command
# Should see in MT5:
# "📨 Received command: PING"
# "✅ PONG"
```

**Expected**: Command succeeds with token

### Test 2: Failed Auth (2 min)
1. In EA settings, change InpSharedSecret to wrong value
2. Send command from Executor
3. **Expected**: "❌ Authentication failed"

### Test 3: Beta Limits (5 min)
Try these via Executor:
1. Open position with 0.1 lot → Should REJECT
2. Try symbol XAUUSD → Should REJECT
3. Open 4 positions → 4th should REJECT

### Test 4: Rate Limiting (2 min)
```bash
# Send 40 API requests rapidly
curl -X GET http://localhost:3000/api/strategy \
  -H "Authorization: Bearer YOUR_TOKEN" \
  # Repeat 40 times

# Should get 429 after 30 requests
```

### Test 5: Emergency Stop (3 min)
1. Open 2 test positions
2. Click Emergency Stop button
3. **Expected**: 
   - Confirmation dialog
   - All positions closed
   - Disconnected from MT5
   - Success message

---

## 🐛 **COMMON ISSUES**

### Issue: "Database not found"
```bash
# Regenerate Prisma client
npx prisma generate
```

### Issue: "ZeroMQ connection failed"
```bash
# Check if ports are free
netstat -an | findstr "5555"
netstat -an | findstr "5556"

# Should show LISTENING on both
```

### Issue: "Authentication failed" in EA
1. Verify shared secret matches exactly (case-sensitive)
2. Check EA log for InpSharedSecret length (should be 32)
3. Restart EA after changing secret

### Issue: "Rate limit exceeded"
Wait 1 minute for reset, or restart server:
```bash
# Kill and restart dev server
npm run dev
```

### Issue: EA not receiving commands
```bash
# Check ZeroMQ connection in Executor logs
# Verify ports:
# - Port 5555: Executor → MT5
# - Port 5556: MT5 ← Executor
```

---

## 📊 **CHECK STATUS**

### Web Platform Health
```bash
# Check if server running
curl http://localhost:3000/api/health

# Expected: 200 OK
```

### Database Health
```bash
# Test connection
npx prisma db pull

# Should complete without errors
```

### Windows Executor Health
Look for:
- ✅ Connected to platform
- ✅ ZeroMQ status: Connected
- ✅ Last heartbeat: < 60 seconds ago

### EA Health
Check MT5 Experts tab:
- ✅ "NusaNexus Bridge initialized"
- ✅ "Listening for commands on port 5556"
- ✅ No error messages

---

## 🔍 **VERIFY BETA FEATURES**

### 1. Check Beta Config
```bash
# In .env file
BETA_MODE=true  # Should be true

# Verify in code
grep -r "BETA_CONFIG.enabled" src/
```

### 2. Check Shared Secret Generation
```bash
# Create new executor and check response
# Should include:
{
  "executor": {
    "apiKey": "exe_xxx",
    "secretKey": "xxx",
    "sharedSecret": "xxx"  // ← Should be present
  }
}
```

### 3. Check Audit Logging
```bash
# Check database
npx prisma studio
# Open AuditLog table
# Should see entries for API_KEY_CREATED

# Check files
ls -la logs/audit/
cat logs/audit/audit-2025-10-26.log
```

### 4. Check Rate Limiting
```javascript
// In browser console
for(let i=0; i<40; i++) {
  fetch('/api/strategy');
}
// Should see 429 after 30 requests
```

---

## 📝 **TESTING CHECKLIST**

Quick checklist for comprehensive testing:

### Setup ✅
- [ ] Web platform running
- [ ] Database connected
- [ ] Windows Executor running
- [ ] EA attached to MT5 chart
- [ ] All credentials configured

### Authentication ✅
- [ ] PING succeeds with token
- [ ] Command fails without token
- [ ] Command fails with wrong token
- [ ] Auto-block after 5 failures
- [ ] Auto-unblock after 5 minutes

### Beta Limits ✅
- [ ] Lot size limit enforced (0.01)
- [ ] Symbol whitelist enforced
- [ ] Max positions enforced (3)
- [ ] Daily trade limit works (20)

### Rate Limiting ✅
- [ ] API rate limit works (30/min)
- [ ] Trade rate limit works (10/min)
- [ ] Rate limit resets after 1 min

### Emergency Stop ✅
- [ ] Button visible and clickable
- [ ] Confirmation dialog shows
- [ ] All positions close
- [ ] All strategies stop
- [ ] Disconnect from MT5
- [ ] Success notification

### Audit Logging ✅
- [ ] Database logs created
- [ ] File logs created
- [ ] Critical events logged
- [ ] Trade events logged

---

## 🎯 **NEXT STEPS AFTER TESTING**

### If All Tests Pass ✅
1. Document any findings
2. Note performance metrics
3. Report to team: "Ready for internal beta"

### If Tests Fail ❌
1. Note which test failed
2. Check relevant logs:
   - Web: Browser console + Server logs
   - Executor: Application logs
   - EA: MT5 Experts tab
3. Review error messages
4. Check documentation for fixes
5. Report issues with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Error messages
   - Screenshots if applicable

---

## 📞 **GETTING HELP**

### Documentation
1. `BETA_IMPLEMENTATION_GUIDE.md` - Full implementation
2. `SHARED_SECRET_FLOW.md` - Authentication flow
3. `BETA_READY_SUMMARY.md` - Complete overview
4. `PLATFORM_AUDIT_REPORT.md` - System audit

### Logs Location
- Web Platform: Terminal/Console
- Windows Executor: `./logs/`
- EA: MT5 Experts tab
- Audit: `./logs/audit/`
- Database: Prisma Studio

### Debug Mode
```bash
# Web Platform - verbose logging
DEBUG=* npm run dev

# Windows Executor - check logs
# Open DevTools (Ctrl+Shift+I)

# EA - check MT5 Experts tab
# Enable all messages in MT5 settings
```

---

## ⚡ **TL;DR - FASTEST PATH**

```bash
# 1. Start web platform
npm run dev

# 2. Create executor → Save 3 credentials

# 3. Start Windows Executor → Enter credentials

# 4. Compile & attach EA → Enter shared secret

# 5. Test PING command

# 6. Done! ✅
```

**Time**: ~15 minutes if everything goes smoothly

---

**Good luck with testing! 🚀**

*Any issues? Check logs and documentation above.*
