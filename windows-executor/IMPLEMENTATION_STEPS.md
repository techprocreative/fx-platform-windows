# Langkah Implementasi Windows Executor Application

## 📋 Instruksi Eksekusi

Berikut adalah langkah-langkah detail untuk memisahkan Windows Executor Application dari web platform yang sudah ada.

### 🗂️ File yang Perlu Dipindahkan

#### 1. File Dokumentasi
Pindahkan file-file berikut dari root directory ke `windows-executor/docs/`:
- `WINDOWS_EXECUTOR_PLAN.md` → `windows-executor/docs/WINDOWS_EXECUTOR_PLAN.md`
- `WINDOWS_EXECUTOR_STRUCTURE.md` → `windows-executor/docs/WINDOWS_EXECUTOR_STRUCTURE.md`
- `IMPLEMENTATION_GUIDE.md` → `windows-executor/docs/IMPLEMENTATION_GUIDE.md`
- `ARCHITECTURE_DIAGRAM.md` → `windows-executor/docs/ARCHITECTURE_DIAGRAM.md`

#### 2. File Implementasi
Pindahkan file-file berikut dari web platform:
- `src/types/mt5.types.ts` → `windows-executor/src/types/mt5.types.ts`
- `src/utils/file-utils.ts` → `windows-executor/src/utils/file-utils.ts`

### 📁 Struktur Folder yang Harus Dibuat

```bash
# Buat struktur folder lengkap
mkdir -p windows-executor/docs
mkdir -p windows-executor/electron
mkdir -p windows-executor/src/app/pages
mkdir -p windows-executor/src/app/components
mkdir -p windows-executor/src/services
mkdir -p windows-executor/src/stores
mkdir -p windows-executor/src/utils
mkdir -p windows-executor/src/types
mkdir -p windows-executor/resources/libs
mkdir -p windows-executor/resources/experts
mkdir -p windows-executor/resources/icons
mkdir -p windows-executor/database
```

### 📄 File Konfigurasi yang Harus Dibuat

#### 1. `windows-executor/package.json`
```json
{
  "name": "fx-platform-executor",
  "version": "1.0.0",
  "description": "FX Trading Platform Windows Executor - Automated MT5 Bridge",
  "main": "dist/electron/main.js",
  "homepage": "./",
  "scripts": {
    "dev": "concurrently \"npm run dev:react\" \"npm run dev:electron\"",
    "dev:react": "vite",
    "dev:electron": "wait-on http://localhost:5173 && electron .",
    "build": "npm run build:react && npm run build:electron",
    "build:react": "vite build",
    "build:electron": "tsc -p electron/tsconfig.json",
    "rebuild": "npm rebuild --runtime=electron --target=28.0.0 --disturl=https://electronjs.org/headers",
    "package:win": "electron-builder --win",
    "package:all": "electron-builder -mwl",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix"
  },
  "keywords": [
    "electron",
    "react",
    "typescript",
    "trading",
    "metatrader",
    "mt5",
    "forex",
    "automated-trading"
  ],
  "author": "FX Platform Team",
  "license": "MIT",
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/jest": "^29.5.8",
    "@types/node": "^20.9.0",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@types/winston": "^2.4.4",
    "@typescript-eslint/eslint-plugin": "^6.11.0",
    "@typescript-eslint/parser": "^6.11.0",
    "@vitejs/plugin-react": "^4.1.1",
    "autoprefixer": "^10.4.16",
    "concurrently": "^8.2.2",
    "electron": "^28.0.0",
    "electron-builder": "^24.6.4",
    "eslint": "^8.54.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "jest": "^29.7.0",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "ts-jest": "^29.1.1",
    "typescript": "^5.2.2",
    "vite": "^4.5.0",
    "vite-plugin-electron": "^0.15.5",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "@journeyapps/sqlcipher": "^5.4.5",
    "@pusher/pusher-websocket-react": "^1.1.0",
    "axios": "^1.6.2",
    "better-sqlite3": "^9.2.2",
    "electron-store": "^8.1.0",
    "electron-updater": "^6.1.7",
    "pusher-js": "^8.0.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.18.0",
    "winston": "^3.11.0",
    "zeromq": "^6.0.0-beta.19",
    "zustand": "^4.4.6"
  }
}
```

#### 2. `windows-executor/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/pages/*": ["src/pages/*"],
      "@/services/*": ["src/services/*"],
      "@/stores/*": ["src/stores/*"],
      "@/utils/*": ["src/utils/*"],
      "@/types/*": ["src/types/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### 3. `windows-executor/electron/tsconfig.json`
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "../dist/electron",
    "noEmit": false,
    "jsx": "preserve"
  },
  "include": ["electron/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 4. `windows-executor/electron-builder.json`
```json
{
  "appId": "com.fxplatform.executor",
  "productName": "FX Platform Executor",
  "directories": {
    "output": "dist",
    "buildResources": "resources"
  },
  "files": [
    "dist/**/*",
    "resources/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "resources/libs",
      "to": "libs"
    },
    {
      "from": "resources/experts",
      "to": "experts"
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64", "ia32"]
      },
      {
        "target": "portable",
        "arch": ["x64", "ia32"]
      }
    ],
    "icon": "resources/icons/icon.ico",
    "requestedExecutionLevel": "requireAdministrator"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "FX Platform Executor",
    "installerIcon": "resources/icons/icon.ico",
    "uninstallerIcon": "resources/icons/icon.ico",
    "installerHeaderIcon": "resources/icons/icon.ico"
  },
  "publish": {
    "provider": "github",
    "owner": "fx-platform",
    "repo": "windows-executor"
  }
}
```

#### 5. `windows-executor/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
});
```

#### 6. `windows-executor/tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

#### 7. `windows-executor/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FX Platform Executor</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

#### 8. `windows-executor/database/schema.sql`
```sql
-- FX Platform Executor Database Schema
-- SQLite with encryption support

-- Configuration table
CREATE TABLE config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MT5 installations table
CREATE TABLE mt5_installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path VARCHAR(500) NOT NULL,
  data_path VARCHAR(500) NOT NULL,
  version VARCHAR(50),
  build INTEGER,
  library_path VARCHAR(500),
  experts_path VARCHAR(500),
  is_running BOOLEAN DEFAULT FALSE,
  broker VARCHAR(100),
  account_number VARCHAR(50),
  is_active BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Command queue table
CREATE TABLE command_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id VARCHAR(255) UNIQUE NOT NULL,
  command_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  status VARCHAR(20) DEFAULT 'PENDING',
  parameters TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  executed_at DATETIME,
  result TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  INDEX idx_command_id (command_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_received_at (received_at)
);

-- Insert default safety limits
INSERT INTO safety_limits (name, value, description) VALUES
('max_daily_loss', 500, 'Maximum daily loss limit in USD'),
('max_positions', 10, 'Maximum number of open positions'),
('max_lot_size', 1.0, 'Maximum lot size per trade'),
('max_drawdown_percent', 20, 'Maximum drawdown percentage');

-- Insert default configuration
INSERT INTO config (key, value, encrypted) VALUES
('executor_id', '', FALSE),
('api_key', '', TRUE),
('api_secret', '', TRUE),
('platform_url', 'https://platform.com', FALSE),
('pusher_key', '', FALSE),
('pusher_cluster', 'mt1', FALSE),
('zmq_port', 5555, FALSE),
('zmq_host', 'tcp://localhost', FALSE),
('heartbeat_interval', 60, FALSE),
('auto_reconnect', 'true', FALSE);
```

### 🔄 Perintah Eksekusi

Setelah semua file dibuat, jalankan perintah berikut:

```bash
# 1. Pindahkan file dokumentasi
mv WINDOWS_EXECUTOR_PLAN.md windows-executor/docs/
mv WINDOWS_EXECUTOR_STRUCTURE.md windows-executor/docs/
mv IMPLEMENTATION_GUIDE.md windows-executor/docs/
mv ARCHITECTURE_DIAGRAM.md windows-executor/docs/

# 2. Pindahkan file implementasi
mv src/types/mt5.types.ts windows-executor/src/types/
mv src/utils/file-utils.ts windows-executor/src/utils/

# 3. Masuk ke folder windows-executor
cd windows-executor

# 4. Install dependencies
npm install

# 5. Build native modules
npm run rebuild

# 6. Run development
npm run dev
```

### ✅ Verifikasi

Setelah implementasi selesai, pastikan:

1. **Tidak ada konflik dengan web platform**:
   - File yang dipindahkan tidak lagi ada di root web platform
   - Import paths di file-file yang dipindahkan sudah diperbaiki
   - Tidak ada dependency yang bentrok

2. **Struktur folder sudah benar**:
   - Semua folder sesuai dengan rencana
   - File konfigurasi sudah lengkap
   - Resource files sudah ada di folder yang tepat

3. **Aplikasi bisa dijalankan**:
   - Development server bisa start tanpa error
   - Build process berjalan lancar
   - Electron application bisa launch

### 📝 Catatan Penting

- Pastikan untuk mengupdate import paths di file yang dipindahkan
- Resource files (libzmq.dll, FX_Platform_Bridge.ex5) perlu ditambahkan manual
- Icons perlu dibuat dan ditempatkan di `resources/icons/`
- Testing dilakukan setelah semua struktur selesai dibuat