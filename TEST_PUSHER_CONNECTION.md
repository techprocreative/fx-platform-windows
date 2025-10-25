# Test Pusher Connection & Command Delivery

## Quick Diagnostic Steps

### 1. Check Web Platform Logs (After Activating Strategy)

Cari di terminal web platform:
```
✅ Command sent to executor cmh4h3aqj0001py6nb05dvjpk: { commandId: '...', channel: 'private-executor-...', event: 'command-received' }
```

**Jika ada log ini** = Command terkirim dari platform ✅

**Jika ada error** = Problem di Pusher credentials platform ❌

### 2. Check Windows Executor Logs

Di console Windows Executor, cari:

**A. Channel Subscription:**
```
[INFO] Successfully subscribed to channel: private-executor-cmh4h3aqj0001py6nb05dvjpk
```

**B. Command Received:**
```
[INFO] Command received: START_STRATEGY
```

**C. Subscription Error:**
```
[ERROR] Channel subscription error
[ERROR] pusher:subscription_error: Status 403
```

### 3. Jika Channel Subscription Error (Status 403)

Ini berarti **authentication gagal**. Check:

#### A. Executor Config File
File: `windows-executor/config/executor-config.json`

```json
{
  "executorId": "cmh4h3aqj0001py6nb05dvjpk",
  "apiKey": "exe_xxx",
  "apiSecret": "yyy",
  "platformUrl": "http://localhost:3000",
  "pusherKey": "sama_dengan_NEXT_PUBLIC_PUSHER_KEY",
  "pusherCluster": "ap1"
}
```

**Pastikan:**
- ✅ `executorId` sama dengan ID di database
- ✅ `apiKey` dan `apiSecret` valid (dari saat create executor)
- ✅ `platformUrl` benar (http://localhost:3000 atau production URL)
- ✅ `pusherKey` dan `pusherCluster` match dengan env web platform

#### B. Test API Auth Endpoint Manually

```bash
curl -X POST http://localhost:3000/api/pusher/auth \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-API-Key: exe_xxx" \
  -H "X-API-Secret: yyy" \
  -d "socket_id=123.456&channel_name=private-executor-cmh4h3aqj0001py6nb05dvjpk"
```

**Expected Response (Success):**
```json
{
  "auth": "pusher_key:signature",
  "channel_data": "{\"user_id\":\"userId\",\"user_info\":{\"authType\":\"api-key\",\"executorId\":\"cmh4h3aqj0001py6nb05dvjpk\"}}"
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized: Invalid credentials"
}
```

### 4. Check Pusher Dashboard (Real-time Debug)

1. Open https://dashboard.pusher.com
2. Select your app
3. Go to "Debug Console"
4. Activate strategy di web platform
5. **Watch for events in real-time:**
   - Channel: `private-executor-{executorId}`
   - Event: `command-received`
   - Data: command payload

**Jika event muncul di Pusher dashboard** = Platform berhasil kirim ke Pusher ✅
**Jika event TIDAK muncul** = Problem di `sendCommandToExecutor()` function ❌

### 5. Test Manual Trigger dari Pusher Dashboard

**Purpose:** Bypass platform, langsung test apakah executor bisa terima command.

1. Go to Pusher Dashboard > Debug Console > Event Creator
2. Fill:
   - **Channel**: `private-executor-cmh4h3aqj0001py6nb05dvjpk` (ganti dengan ID Anda)
   - **Event**: `command-received`
   - **Data**:
   ```json
   {
     "id": "test-manual-123",
     "type": "START_STRATEGY",
     "executorId": "cmh4h3aqj0001py6nb05dvjpk",
     "payload": {
       "strategyId": "test",
       "strategyName": "Manual Test Strategy",
       "symbol": "EURUSD",
       "timeframe": "M15"
     },
     "timestamp": "2025-01-20T10:00:00Z"
   }
   ```
3. Click "Send Event"
4. **Check Windows Executor log** - should see:
   ```
   [INFO] Command received: START_STRATEGY
   ```

**Jika executor terima** = Executor connection OK, problem di web platform ✅
**Jika executor TIDAK terima** = Executor subscription failed ❌

## Common Issues & Fixes

### Issue 1: Subscription Error 403
**Symptom:**
```
[ERROR] pusher:subscription_error: Status 403
```

**Root Cause:** Authentication gagal di `/api/pusher/auth`

**Fix:**
1. Pastikan `X-API-Key` dan `X-API-Secret` benar di executor-config.json
2. Restart Windows Executor setelah update config
3. Check database - pastikan API key valid dan tidak expired

### Issue 2: Subscription Succeeded tapi Command Tidak Sampai
**Symptom:**
```
[INFO] Successfully subscribed to channel: private-executor-xxx
```
Tapi tidak ada `[INFO] Command received`

**Root Cause:** Event name atau payload format mismatch

**Fix:**
1. Check event name: harus `command-received` (case-sensitive)
2. Check payload structure di activate route
3. Check `handleCommand()` di pusher.service.ts

### Issue 3: Platform Log "Command Sent" tapi Tidak Muncul di Pusher Dashboard
**Root Cause:** Pusher credentials invalid di platform

**Fix:**
1. Check `.env.local`:
   ```
   PUSHER_APP_ID=xxx
   NEXT_PUBLIC_PUSHER_KEY=yyy
   PUSHER_SECRET=zzz
   NEXT_PUBLIC_PUSHER_CLUSTER=ap1
   ```
2. Restart development server: `npm run dev`
3. Test dengan Pusher library test page

### Issue 4: Command Terkirim tapi Executor Offline
**Symptom:** Command masuk database, tapi executor tidak process

**Root Cause:** Executor disconnected atau crash

**Fix:**
1. Check executor process is running
2. Check executor logs for crash/error
3. Restart executor application
4. Check MT5 connection status

## Expected Flow (Success)

```
1. User clicks "Activate Strategy" di web platform
   ↓
2. POST /api/strategy/{id}/activate
   ↓
3. Create Command in database (status: pending)
   ↓
4. sendCommandToExecutor() via Pusher
   ↓
5. Platform log: ✅ Command sent to executor xxx
   ↓
6. Pusher dashboard: Event appears in real-time
   ↓
7. Windows Executor receives: [INFO] Command received: START_STRATEGY
   ↓
8. Executor processes command
   ↓
9. Update Command status: pending → executed
   ↓
10. Strategy starts running on executor
```

## Next Steps If Still Failing

1. **Enable debug mode** di kedua sisi
2. **Capture network traffic** (Wireshark/Fiddler) untuk lihat WebSocket messages
3. **Check firewall** - Pusher uses port 443 (WSS)
4. **Try different Pusher cluster** (ap1, us2, eu, etc.)
5. **Contact Pusher support** jika problem di sisi mereka

## Test Checklist

- [ ] Web platform log shows "✅ Command sent"
- [ ] Pusher dashboard shows event triggered
- [ ] Windows Executor log shows "Successfully subscribed to channel"
- [ ] Windows Executor log shows "Command received: START_STRATEGY"
- [ ] Command status in database changes from pending → executed
- [ ] Strategy starts running on executor
- [ ] Manual trigger from Pusher dashboard works

**If ALL checklist ✅** = Everything working perfectly! 🎉
**If some ❌** = Follow diagnostic steps above for failed items
