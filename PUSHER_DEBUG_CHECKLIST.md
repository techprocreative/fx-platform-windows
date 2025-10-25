# Pusher Debug Checklist - Command Not Received

## Problem
Commands are created in database but not received by Windows Executor.

## Checklist untuk Debug

### 1. ✅ Cek Pusher Environment Variables (.env.local)
```bash
PUSHER_APP_ID=your_app_id
NEXT_PUBLIC_PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster
```

Cara cek:
```bash
# Di terminal web platform
echo $env:PUSHER_APP_ID
echo $env:NEXT_PUBLIC_PUSHER_KEY
```

### 2. ✅ Cek Executor Config (Windows Executor)
File: `windows-executor/config/executor-config.json`

Pastikan ada:
```json
{
  "executorId": "cmh4h3aqj0001py6nb05dvjpk",
  "pusher": {
    "key": "sama_dengan_NEXT_PUBLIC_PUSHER_KEY",
    "cluster": "sama_dengan_NEXT_PUBLIC_PUSHER_CLUSTER"
  }
}
```

### 3. ✅ Cek Pusher Connection Status di Executor
Di console Windows Executor, cari log:
```
[INFO] Successfully subscribed to channel: private-executor-{executorId}
```

Jika tidak ada, cari error:
```
[ERROR] Channel subscription error
[ERROR] Pusher connection failed
```

### 4. ✅ Cek Log di Web Platform Console
Setelah aktivasi strategi, cari log:
```
✅ Command sent to executor xxx: { commandId: 'xxx', channel: 'private-executor-xxx', event: 'command-received' }
```

Atau error:
```
❌ Failed to send command to executor xxx
```

### 5. ✅ Test Manual dengan Pusher Dashboard
1. Buka https://dashboard.pusher.com
2. Pilih app Anda
3. Go to "Debug Console"
4. Trigger event manual:
   - Channel: `private-executor-{executorId}`
   - Event: `command-received`
   - Data: 
   ```json
   {
     "id": "test-123",
     "type": "START_STRATEGY",
     "executorId": "cmh4h3aqj0001py6nb05dvjpk",
     "payload": {
       "strategyId": "test",
       "strategyName": "Test Strategy"
     }
   }
   ```

### 6. ✅ Cek Pusher Connection di Browser DevTools
Jika menggunakan web interface dengan Pusher:
1. Buka DevTools (F12)
2. Network tab → Filter "websocket" atau "ws"
3. Cari connection ke Pusher
4. Cek status: Connected atau Failed

### 7. ✅ Restart Services
```bash
# Restart web platform
npm run dev

# Restart Windows Executor
# Close dan buka lagi aplikasi
```

## Common Issues

### Issue 1: Pusher Credentials Invalid
**Symptom**: `Pusher not configured` di log
**Fix**: Periksa .env.local dan pastikan semua PUSHER_* variables ada

### Issue 2: Channel Subscription Failed
**Symptom**: `Channel subscription error` di executor log
**Fix**: 
- Cek executorId di executor-config.json
- Pastikan executor sudah authenticated dengan API key yang benar
- Cek Pusher dashboard untuk channel activity

### Issue 3: Private Channel Auth Failed
**Symptom**: `subscription_error` dengan status 403
**Fix**: Implement proper channel authentication di `/api/pusher/auth`

### Issue 4: Event Name Mismatch
**Symptom**: Command sent tapi tidak di-handle
**Fix**: 
- Server: `command-received` ✅
- Executor: Bind to `command-received` ✅
- Pastikan case-sensitive match

## Testing Flow

1. **Activate strategy** di web platform
2. **Check web platform logs** untuk confirmation command sent
3. **Check executor logs** untuk command received
4. **Check database** - Command status should change from `pending` → `executed`
5. **Check Pusher dashboard** - Should see event triggered

## Next Steps

Jika semua checklist ✅ tapi masih tidak bekerja:
1. Enable debug mode di Pusher service (kedua sisi)
2. Check network firewall - Pusher menggunakan port 443 (WSS)
3. Try with different Pusher cluster
4. Contact Pusher support jika masalah di sisi mereka
