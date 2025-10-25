# Quick Deployment Check

## 1. Check Latest Commit di Vercel
Buka: https://vercel.com/your-project/deployments

Pastikan commit terbaru adalah:
```
fix: correct command structure for executor compatibility
Commit: 0dc60f9
```

## 2. Test Command Structure dari Production

Buka browser console di web platform production, jalankan:
```javascript
// Test send command
fetch('/api/debug/pusher-test', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({executorId: 'cmh4h3aqj0001py6nb05dvjpk'})
}).then(r => r.json()).then(console.log)
```

Expected response harus include:
```json
{
  "success": true,
  "command": {
    "id": "test_...",
    "command": "GET_STATUS",  // ← HARUS ADA FIELD INI
    "type": "GET_STATUS"
  }
}
```

## 3. Check Executor Log Detail

Di Windows Executor, log seharusnya menampilkan:
```
[INFO] Raw command received: {
  commandId: "...",
  command: "START_STRATEGY",  // ← CEK INI
  type: "START_STRATEGY",
  hasCommand: true,           // ← HARUS true
  hasId: true,
  dataKeys: [...]
}
```

Jika log menampilkan:
```
hasCommand: false
```

Berarti code di Vercel BELUM ter-update!

## 4. Force Refresh Vercel Deployment

Jika belum update:
1. Go to Vercel dashboard
2. Redeploy latest commit
3. Atau push dummy commit untuk trigger rebuild
