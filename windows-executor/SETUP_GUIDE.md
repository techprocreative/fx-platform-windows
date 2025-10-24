# Windows Executor - Setup Guide

## ✅ Aplikasi Berhasil Di-build

Aplikasi sudah siap, tapi **perlu konfigurasi pertama kali** (first-run setup).

---

## 🚀 Cara Menjalankan

### 1. Jalankan EXE
```bash
cd "dist-packager/FX Platform Executor-win32-x64"
."FX Platform Executor.exe"
```

### 2. Setup Wizard (First Run)
Saat pertama kali jalan, aplikasi akan menampilkan **Setup Wizard** yang meminta:

#### A. Executor Configuration
- **Executor ID**: Unique identifier untuk executor ini
- **API Key**: API key dari platform
- **API Secret**: Secret key untuk authentication

#### B. Platform Connection
- **Platform URL**: URL FX Platform (default: `https://platform.com`)
- **Pusher Key**: Pusher app key untuk real-time communication
- **Pusher Cluster**: Pusher cluster (default: `mt1`)

#### C. MT5 Connection
- **ZeroMQ Port**: Port untuk komunikasi dengan MT5 (default: `5555`)
- **ZeroMQ Host**: Host MT5 (default: `tcp://localhost`)

#### D. Settings
- **Heartbeat Interval**: Interval heartbeat dalam detik (default: `60`)
- **Auto Reconnect**: Enable auto-reconnect (default: `true`)

---

## 📝 Contoh Konfigurasi

```json
{
  "executorId": "executor-001",
  "apiKey": "your-api-key-here",
  "apiSecret": "your-secret-key-here",
  "platformUrl": "https://your-platform.com",
  "pusherKey": "your-pusher-key",
  "pusherCluster": "mt1",
  "zmqPort": 5555,
  "zmqHost": "tcp://localhost",
  "heartbeatInterval": 60,
  "autoReconnect": true
}
```

---

## 🔧 Persyaratan

### 1. MT5 Installation
Aplikasi akan **otomatis detect** MT5 yang terinstall di:
- `C:\Program Files\MetaTrader 5\`
- `C:\Program Files (x86)\MetaTrader 5\`
- Custom directories dari Windows Registry

### 2. MT5 Components (Auto-Install)
Aplikasi akan **otomatis install**:
- ✅ ZeroMQ DLL (libzmq.dll)
- ✅ Expert Advisor (FX_Platform_Bridge.ex5)
- ✅ Include files (.mqh)

Jika tidak ada MT5, aplikasi akan memberikan **warning** dan skip initialization.

---

## ❌ Troubleshooting

### "Failed to initialize executor"
**Penyebab**: Konfigurasi belum lengkap atau MT5 tidak terdetect

**Solusi**:
1. Pastikan MT5 sudah terinstall
2. Lengkapi semua field di Setup Wizard
3. Cek koneksi internet (untuk Pusher)
4. Pastikan MT5 EA sudah enabled

### "MT5 Not Found"
**Penyebab**: MT5 tidak terinstall atau tidak di path standard

**Solusi**:
1. Install MT5 dari broker
2. Atau manual specify MT5 path di settings
3. Restart aplikasi setelah install MT5

### "Connection Failed"
**Penyebab**: 
- Platform URL salah
- API credentials invalid
- ZeroMQ port blocked
- Pusher credentials salah

**Solusi**:
1. Cek API key & secret
2. Pastikan platform URL benar (dengan https://)
3. Cek ZeroMQ port tidak dipakai aplikasi lain
4. Verify Pusher credentials di platform

---

## 📂 File Locations

### Configuration
```
%APPDATA%/fx-executor-config/config.json
```

### Logs
```
%APPDATA%/fx-executor/logs/
├── combined.log
├── error.log
├── security.log
├── trading.log
└── performance.log
```

### Database
```
%APPDATA%/fx-executor/executor.db
```

---

## 🔄 Reset Configuration

Jika perlu reset setup:

1. **Delete config file**:
   ```bash
   Remove-Item "$env:APPDATA/fx-executor-config/config.json"
   ```

2. **Restart aplikasi** - Setup Wizard akan muncul lagi

---

## ✨ Setelah Setup

Setelah konfigurasi lengkap, aplikasi akan:

1. ✅ Detect MT5 installations
2. ✅ Auto-install required components
3. ✅ Connect ke Platform (Pusher)
4. ✅ Connect ke MT5 (ZeroMQ)
5. ✅ Start heartbeat service
6. ✅ Ready untuk trading!

Dashboard akan menampilkan:
- Connection status
- Active strategies
- Performance metrics
- Recent activity

---

## 🎯 Mode Development

Untuk testing tanpa full setup:

```bash
cd windows-executor
npm run dev
```

Ini akan:
- Start Vite dev server (React)
- Launch Electron dengan hot-reload
- Show console untuk debugging

---

## 📞 Support

Jika ada masalah:
1. Check logs di `%APPDATA%/fx-executor/logs/`
2. Check console output (Ctrl+Shift+I di app)
3. Verify MT5 EA sudah running
4. Test koneksi platform manual
