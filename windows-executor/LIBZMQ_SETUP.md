# LibZMQ Setup Guide untuk FX Platform Windows Executor

## Overview

Windows Executor menggunakan ZeroMQ (libzmq) untuk komunikasi high-performance dengan MetaTrader 5. Package `zeromq` npm sudah menyertakan source code libzmq dan akan mengkompilasi secara otomatis saat instalasi.

## Prerequisites

### Untuk Development (Windows)

1. **Node.js** >= 18.0.0
2. **npm** >= 9.0.0
3. **Visual Studio Build Tools 2019 atau lebih baru**
   - Download dari: https://visualstudio.microsoft.com/downloads/
   - Pilih "Build Tools for Visual Studio"
   - Install dengan workload "Desktop development with C++"
   - Atau minimal: MSVC, Windows SDK, dan C++ CMake tools

### Untuk Development (Linux/Mac - Cross-compilation)

1. **Node.js** >= 18.0.0
2. **npm** >= 9.0.0
3. **Python** >= 3.8 (untuk node-gyp)
4. **Build essentials** (gcc, g++, make)

## Instalasi

### Method 1: Automatic Installation (Recommended)

Package `zeromq` akan otomatis mengkompilasi libzmq saat npm install:

```bash
cd windows-executor
npm install
```

### Method 2: Rebuild untuk Electron

Jika Anda sudah menginstall dependencies tapi perlu rebuild untuk Electron:

```bash
cd windows-executor
npm run rebuild
```

Script ini akan:
- Rebuild zeromq native module untuk Electron runtime
- Target Electron version 28.0.0
- Compile dengan proper headers

### Method 3: Manual Build

Jika automatic build gagal:

```bash
cd windows-executor

# Install dependencies
npm install

# Rebuild zeromq untuk Electron
npm rebuild zeromq --runtime=electron --target=28.0.0 --disturl=https://electronjs.org/headers

# Atau build semua native modules
npm run rebuild
```

## Verifikasi Instalasi

### 1. Check Package Installation

```bash
npm ls zeromq
```

Expected output:
```
fx-platform-executor@1.0.0
└── zeromq@6.5.0
```

### 2. Test Import in Node.js

```javascript
// test-zeromq.js
const zmq = require('zeromq');
console.log('ZeroMQ version:', zmq.version);
console.log('ZeroMQ loaded successfully!');
```

Run:
```bash
node test-zeromq.js
```

### 3. Check Native Binary

Setelah build, native module akan berada di:
```
node_modules/zeromq/build/Release/zeromq.node
```

## Troubleshooting

### Error: "Cannot find module 'zeromq'"

**Solusi:**
```bash
# Reinstall zeromq
npm uninstall zeromq
npm install zeromq

# Rebuild untuk Electron
npm run rebuild
```

### Error: "MSBuild not found" (Windows)

**Solusi:**
1. Install Visual Studio Build Tools 2019+
2. Pastikan MSVC dan Windows SDK terinstall
3. Restart terminal/command prompt
4. Coba install lagi

### Error: "Python not found"

**Solusi:**
```bash
# Windows
npm install --global windows-build-tools

# Linux/Mac
# Install Python 3.x dari package manager
```

### Error: "node-gyp rebuild failed"

**Solusi:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules
rm package-lock.json

# Install dengan verbose logging
npm install --verbose
```

### Error saat Runtime di Electron

**Solusi:**
```bash
# Pastikan rebuild untuk Electron runtime
npm run rebuild

# Atau manual
./node_modules/.bin/electron-rebuild
```

## Pre-built DLLs (Optional)

Script `download-libzmq.js` mencoba mendownload pre-built libzmq DLLs, tapi ini **TIDAK WAJIB** karena zeromq package sudah menyertakan source code.

### Mengapa Pre-built DLLs Tidak Tersedia?

GitHub releases untuk libzmq tidak menyediakan pre-built DLLs langsung. Sebagai gantinya:
- Package `zeromq` npm sudah include libzmq source
- Compilation otomatis saat npm install
- Lebih reliable dan compatible dengan Node.js/Electron version yang digunakan

### Jika Ingin Manual DLL Installation

1. Download dari: https://github.com/zeromq/libzmq/releases
2. Extract dan copy DLL ke `resources/libs/`
3. Rename menjadi `libzmq-x64.dll`

**CATATAN:** Ini biasanya TIDAK diperlukan untuk development normal.

## Configuration

### ZeroMQ Connection Settings

Edit `src/types/config.types.ts` atau runtime config:

```typescript
const config: AppConfig = {
  zmqHost: 'localhost',     // MT5 ZeroMQ server host
  zmqPort: 5555,            // MT5 ZeroMQ server port
  zmqTimeout: 30000,        // Request timeout (ms)
  zmqReconnectDelay: 5000,  // Reconnection delay (ms)
  // ... other config
};
```

### MT5 Expert Advisor (EA) Setup

EA harus menggunakan ZeroMQ dengan konfigurasi matching:

```mql5
// MT5 EA (MQL5)
#include <Zmq/Zmq.mqh>

Context context;
Socket socket(context, ZMQ_REP);

void OnInit() {
  // Bind to same port as config
  socket.bind("tcp://*:5555");
}
```

## Usage Example

### Basic Connection

```typescript
import { ZeroMQService } from './services/zeromq.service';

const zmqService = new ZeroMQService();

// Connect
await zmqService.connect({
  zmqHost: 'localhost',
  zmqPort: 5555,
  zmqTimeout: 30000
});

// Send command
const result = await zmqService.sendCommand({
  action: 'OPEN_TRADE',
  params: {
    symbol: 'EURUSD',
    volume: 0.1,
    type: 'BUY'
  }
});

console.log('Trade result:', result);
```

### With Error Handling

```typescript
try {
  const result = await zmqService.sendCommand(command);
  if (result.success) {
    console.log('Success:', result.data);
  } else {
    console.error('Trade failed:', result.error);
  }
} catch (error) {
  console.error('ZeroMQ error:', error);
  // Handle reconnection
  await zmqService.reconnect();
}
```

## Performance Tips

### 1. Connection Pooling

ZeroMQService sudah implement connection pooling:

```typescript
private maxPoolSize = 3; // Adjust based on load
```

### 2. Request Timeout

Set appropriate timeout berdasarkan network latency:

```typescript
zmqTimeout: 30000 // 30 seconds untuk network yang lambat
```

### 3. Reconnection Strategy

```typescript
private maxReconnectAttempts = 5;
private reconnectDelay = 5000; // Exponential backoff
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Windows Executor (Electron)              │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │       ZeroMQService                  │       │
│  │  - Connection Pool                   │       │
│  │  - Request Queue                     │       │
│  │  - Timeout Management                │       │
│  └──────────────┬───────────────────────┘       │
│                 │                                │
│                 │ TCP Socket (5555)              │
└─────────────────┼────────────────────────────────┘
                  │
                  │ ZeroMQ Protocol (REQ/REP)
                  │
┌─────────────────┼────────────────────────────────┐
│                 │                                │
│  ┌──────────────▼───────────────────────┐       │
│  │     MT5 Expert Advisor (EA)          │       │
│  │  - ZeroMQ Server (REP Socket)        │       │
│  │  - Trade Execution                   │       │
│  │  - Position Management               │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│         MetaTrader 5 Terminal                    │
└──────────────────────────────────────────────────┘
```

## Testing

### Unit Tests

```bash
npm test -- zeromq.service.test.ts
```

### Integration Tests

```bash
# Pastikan MT5 dengan EA running
npm run test:integration
```

### Manual Testing

```bash
# Terminal 1: Start MT5 dengan EA
# Terminal 2: Run executor
npm run dev
```

## Production Deployment

### 1. Build

```bash
npm run build
npm run package:win
```

### 2. Dependencies

Distributable akan include:
- `zeromq.node` (native binary)
- Node.js runtime (embedded in Electron)
- Semua JavaScript files

### 3. Installation pada Client

```bash
# Run installer
FXPlatformExecutor-Setup-1.0.0.exe

# Native modules sudah compiled dan included
# Tidak perlu build tools pada client machine
```

## Additional Resources

- [ZeroMQ Official Guide](https://zeromq.org/get-started/)
- [zeromq.js Documentation](https://github.com/zeromq/zeromq.js)
- [Electron Native Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [MT5 MQL5 ZeroMQ](https://www.mql5.com/en/code/28225)

## Support

Jika mengalami masalah:

1. Check diagnostics:
   ```bash
   npm run diagnostics
   ```

2. Check logs:
   ```bash
   # Electron logs
   cat ~/AppData/Roaming/fx-platform-executor/logs/main.log
   ```

3. Enable debug mode:
   ```typescript
   process.env.DEBUG = 'zeromq:*';
   ```

4. Contact development team dengan:
   - Error logs
   - System info (OS, Node version, npm version)
   - Steps to reproduce

## License

ZeroMQ is licensed under LGPL-3.0 with static linking exception
zeromq.js is licensed under MIT