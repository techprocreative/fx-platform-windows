# Debug Guide: EA Attachment Not Showing

## Problem
EA sudah di-attach ke XAUUSD di MT5, tapi badge "EA Attached" tidak muncul di Dashboard.

## Debug Steps

### 1. Open Browser DevTools in App
- Di Windows Executor app, tekan **`Ctrl + Shift + I`**
- Atau tekan **`F12`**
- DevTools akan muncul di sebelah kanan/bawah

### 2. Go to Console Tab
- Klik tab **Console** di DevTools
- Semua debug logs akan muncul di sini

### 3. Look for These Logs

#### When Dashboard Loads:
```
[Dashboard] EA Attachments loaded: Array(X)
  0: {symbol: "EURUSD", timeframe: "M15", accountNumber: "123456", ...}
  1: {symbol: "XAUUSD", timeframe: "H1", accountNumber: "123456", ...}
```

**✅ Expected:** Array should contain EA attachments
**❌ Problem:** Array is empty `[]` or doesn't contain XAUUSD

#### When Strategy Cards Render:
```
[Render] Strategy: CCI EMA Scalping Strategy, EA Attached: false
  symbols: ["XAUUSD"]
  timeframe: "M15"

[EA Check] ❌ No attachment found for CCI EMA Scalping Strategy
  symbols: ["XAUUSD"]
  timeframe: "M15"
  availableAttachments: []
```

**✅ Expected:** `EA Attached: true`
**❌ Problem:** `EA Attached: false` and `availableAttachments: []`

### 4. Common Issues & Solutions

#### Issue A: Empty EA Attachments Array
```
[Dashboard] EA Attachments loaded: []
```

**Cause:** No EA marked as attached yet  
**Solution:** Click "Mark EA Attached" button for the strategy

---

#### Issue B: Symbol Mismatch
```
[EA Check] ❌ No attachment found
  symbols: ["XAUUSD"]  
  availableAttachments: [{symbol: "XAUUSD.m", ...}]
```

**Cause:** Symbol name tidak sama (XAUUSD vs XAUUSD.m)  
**Solution:** Pastikan symbol name di strategy dan EA attachment persis sama

---

#### Issue C: Timeframe Mismatch
```
Strategy timeframe: "M15"
EA attachment timeframe: "H1"
```

**Cause:** Strategy menggunakan M15, tapi EA di-attach di H1  
**Solution:** Mark EA attached dengan timeframe yang benar (M15)

---

#### Issue D: Account Number Issue
```
[EA Attach] Notifying EA attached: { 
  symbol: "XAUUSD",
  timeframe: "M15",
  accountNumber: ""  ❌ Empty!
}
```

**Cause:** Account number tidak terdeteksi  
**Solution:** Input account number manually saat prompt

---

### 5. Mark EA Attached Manually

1. Find strategy card in Dashboard
2. Click **"Mark EA Attached"** button (green)
3. If multiple symbols, choose **XAUUSD** from prompt
4. Input account number if prompted
5. Check console logs:

```
[EA Attach] Notifying EA attached: { 
  symbol: "XAUUSD",
  timeframe: "M15",
  accountNumber: "123456"
}
[EA Attach] ✅ EA marked as attached successfully
```

6. Refresh dashboard or wait for auto-reload
7. Badge "⚡ EA Attached" should appear

---

### 6. Verify EA Attachment Persisted

1. Close aplikasi completely
2. Open aplikasi lagi
3. Check console logs:

```
[Dashboard] EA Attachments loaded: Array(1)
  0: {symbol: "XAUUSD", timeframe: "M15", ...}  ✅

[EA Check] ✅ Found attachment for XAUUSD M15
[Render] Strategy: CCI EMA Scalping Strategy, EA Attached: true ✅
```

---

## Electron Store Location

EA attachment state disimpan di:
```
C:\Users\{USERNAME}\AppData\Roaming\fx-platform-executor\
```

File: `fx-executor-state.json`

### Check Stored Data:
```json
{
  "activeStrategies": [
    {
      "id": "cmh2wkcw500013mswpt0vsybb",
      "name": "CCI EMA Scalping Strategy",
      "symbol": "XAUUSD",
      "timeframe": "M15",
      "status": "active",
      "activatedAt": "2025-10-25T09:51:49.000Z",
      "eaAttached": true,
      "eaAttachmentState": {
        "symbol": "XAUUSD",
        "timeframe": "M15",
        "accountNumber": "123456",
        "attachedAt": "2025-10-25T10:00:00.000Z"
      }
    }
  ],
  "eaAttachments": [
    {
      "symbol": "XAUUSD",
      "timeframe": "M15",
      "accountNumber": "123456",
      "attachedAt": "2025-10-25T10:00:00.000Z"
    }
  ]
}
```

---

## Quick Test Checklist

- [ ] DevTools opened (Ctrl+Shift+I)
- [ ] Console tab selected
- [ ] Dashboard refreshed
- [ ] Log `[Dashboard] EA Attachments loaded` shows array
- [ ] Strategy card shows with button
- [ ] Click "Mark EA Attached" button
- [ ] Log `[EA Attach] ✅ EA marked as attached successfully`
- [ ] Badge "⚡ EA Attached" appears
- [ ] Restart app - badge still there

---

## Need More Help?

1. **Take screenshot** of browser console
2. **Copy all console logs** (right-click → Save as...)
3. **Check** `fx-executor-state.json` file content
4. Share ke team untuk analysis
