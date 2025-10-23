# Windows Executor Platform - Struktur Proyek Lengkap

## 📁 Struktur Folder

```
windows-executor/
├── electron/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Preload script
│   └── installer.ts               # Auto-installer untuk libzmq.dll
│
├── src/
│   ├── app/
│   │   ├── App.tsx                # Main React app
│   │   ├── pages/
│   │   │   ├── Setup.tsx          # Setup wizard
│   │   │   ├── Dashboard.tsx      # Main dashboard
│   │   │   ├── Settings.tsx       # Settings page
│   │   │   └── Logs.tsx           # Logs viewer
│   │   │
│   │   └── components/
│   │       ├── StatusBar.tsx
│   │       ├── ActivityLog.tsx
│   │       ├── PerformanceCard.tsx
│   │       └── EmergencyButton.tsx
│   │
│   ├── services/
│   │   ├── pusher.service.ts      # Pusher client
│   │   ├── api.service.ts         # REST API client
│   │   ├── heartbeat.service.ts   # Heartbeat manager
│   │   ├── zeromq.service.ts      # ZeroMQ bridge
│   │   ├── command.service.ts     # Command processor
│   │   ├── safety.service.ts      # Safety checks
│   │   └── mt5-detector.service.ts # MT5 detection
│   │
│   ├── stores/
│   │   ├── app.store.ts           # Global state
│   │   ├── config.store.ts        # Configuration
│   │   └── logs.store.ts          # Logs
│   │
│   ├── utils/
│   │   ├── crypto.ts              # Encryption helpers
│   │   ├── logger.ts              # Winston logger
│   │   └── priority-queue.ts     # Priority queue
│   │
│   └── types/
│       ├── command.types.ts
│       ├── mt5.types.ts
│       └── config.types.ts
│
├── resources/
│   ├── libs/
│   │   └── libzmq.dll             # ZeroMQ library (32-bit & 64-bit)
│   │
│   ├── experts/
│   │   └── FX_Platform_Bridge.ex5 # MT5 Expert Advisor
│   │
│   └── icons/
│       ├── icon.ico
│       └── icon.png
│
├── database/
│   └── schema.sql                 # SQLite schema for local storage
│
├── package.json
├── electron-builder.json          # Build configuration
├── tsconfig.json
└── README.md
```

## 📦 Package.json

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
  },
  "build": {
    "appId": "com.fxplatform.executor",
    "productName": "FX Platform Executor",
    "directories": {
      "output": "dist"
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
      "shortcutName": "FX Platform Executor"
    },
    "publish": {
      "provider": "github",
      "owner": "fx-platform",
      "repo": "windows-executor"
    }
  }
}
```

## ⚙️ Konfigurasi TypeScript

### tsconfig.json

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

### electron/tsconfig.json

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

## 🔧 Konfigurasi Build

### electron-builder.json

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

## 🎨 Konfigurasi Tailwind CSS

### tailwind.config.ts

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

## 📊 Database Schema

### database/schema.sql

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

-- Command history table
CREATE TABLE command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id VARCHAR(255) NOT NULL,
  command_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  received_at DATETIME NOT NULL,
  executed_at DATETIME,
  completed_at DATETIME,
  result TEXT,
  error_message TEXT,
  execution_time_ms INTEGER,
  INDEX idx_command_id (command_id),
  INDEX idx_status (status),
  INDEX idx_received_at (received_at),
  INDEX idx_executed_at (executed_at)
);

-- Activity logs table
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(10) NOT NULL,
  category VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  INDEX idx_timestamp (timestamp),
  INDEX idx_level (level),
  INDEX idx_category (category)
);

-- Trade records table
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket INTEGER UNIQUE NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL,
  volume DECIMAL(10, 2) NOT NULL,
  open_price DECIMAL(10, 5) NOT NULL,
  close_price DECIMAL(10, 5),
  open_time DATETIME NOT NULL,
  close_time DATETIME,
  profit DECIMAL(10, 2),
  commission DECIMAL(10, 2),
  swap DECIMAL(10, 2),
  comment VARCHAR(255),
  magic_number INTEGER,
  status VARCHAR(20) DEFAULT 'OPEN',
  INDEX idx_ticket (ticket),
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_open_time (open_time)
);

-- Performance metrics table
CREATE TABLE performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_profit DECIMAL(15, 2) DEFAULT 0,
  total_loss DECIMAL(15, 2) DEFAULT 0,
  net_profit DECIMAL(15, 2) DEFAULT 0,
  win_rate DECIMAL(5, 2) DEFAULT 0,
  profit_factor DECIMAL(10, 2) DEFAULT 0,
  max_drawdown DECIMAL(10, 2) DEFAULT 0,
  sharpe_ratio DECIMAL(10, 2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (date)
);

-- Safety limits table
CREATE TABLE safety_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  value DECIMAL(15, 2) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Heartbeat logs table
CREATE TABLE heartbeat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL,
  response_time_ms INTEGER,
  metadata TEXT,
  INDEX idx_timestamp (timestamp),
  INDEX idx_status (status)
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

## 📝 README.md

```markdown
# FX Platform Windows Executor

Aplikasi desktop Windows Executor yang berfungsi sebagai jembatan antara Web Platform dan MetaTrader 5/4 dengan fitur **FULL-AUTOMATED**.

## 🚀 Fitur Utama

- **🤖 Auto-Detection & Installation** - Otomatis mendeteksi SEMUA instalasi MT5
- **⚡ Zero-Configuration Setup** - User hanya perlu input API Key dan Secret
- **🔗 Komunikasi Real-time** - Menggunakan Pusher untuk menerima command instant
- **🚀 Eksekusi Trade** - Mengirim perintah trading ke MT5 via ZeroMQ
- **📊 Monitoring & Safety** - Real-time monitoring koneksi dan trade

## 📋 Prerequisites

- Node.js 18+
- Python (untuk node-gyp)
- Visual Studio Build Tools (Windows)

## 🔧 Instalasi & Development

1. Clone repository
```bash
git clone <repo-url>
cd windows-executor
```

2. Install dependencies
```bash
npm install
```

3. Build native modules (zeromq)
```bash
npm run rebuild
```

4. Run development
```bash
npm run dev
```

5. Build for production
```bash
npm run build
```

6. Package untuk Windows
```bash
npm run package:win
```

## 📁 Struktur Proyek

```
windows-executor/
├── electron/          # Electron main process
├── src/               # React application
├── resources/         # Assets (libs, experts, icons)
├── database/          # SQLite schema
└── dist/              # Build output
```

## 🔐 Keamanan

- API credentials disimpan dengan encryption
- Semua komunikasi menggunakan HTTPS
- Local database dengan SQLCipher encryption

## 📞 Support

Untuk bantuan, hubungi tim support FX Platform.
```

## 📋 TypeScript Type Definitions

### src/types/command.types.ts

```typescript
export interface Command {
  id: string;
  command: string;
  parameters?: Record<string, any>;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
}

export interface CommandResult {
  success: boolean;
  ticket?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SafetyCheck {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

export interface TradeParams {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  magicNumber?: number;
}

export interface SafetyLimits {
  maxDailyLoss: number;
  maxPositions: number;
  maxLotSize: number;
  maxDrawdownPercent: number;
}
```

### src/types/mt5.types.ts

```typescript
export interface MT5Info {
  path: string;
  dataPath: string;
  version: string;
  build: number;
  libraryPath: string;
  expertsPath: string;
  isRunning: boolean;
  broker?: string;
  accountNumber?: string;
}

export interface MT5AccountInfo {
  login: number;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  openPositions: number;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  closePrice?: number;
  openTime: Date;
  closeTime?: Date;
  profit: number;
  commission: number;
  swap: number;
  comment?: string;
  magicNumber?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface TradeResult {
  success: boolean;
  ticket?: number;
  openPrice?: number;
  openTime?: string;
  message?: string;
  error?: string;
}
```

### src/types/config.types.ts

```typescript
export interface AppConfig {
  executorId: string;
  apiKey: string;
  apiSecret: string;
  platformUrl: string;
  pusherKey: string;
  pusherCluster: string;
  zmqPort: number;
  zmqHost: string;
  heartbeatInterval: number;
  autoReconnect: boolean;
}

export interface InstallProgress {
  step: number;
  message: string;
  progress?: number;
}

export interface InstallResult {
  success: boolean;
  mt5Installations: MT5Info[];
  componentsInstalled: {
    libzmq: boolean;
    expertAdvisor: boolean;
    configFile: boolean;
  };
  errors: string[];
}

export interface ConnectionStatus {
  pusher: 'connected' | 'disconnected' | 'error';
  zeromq: 'connected' | 'disconnected' | 'error';
  api: 'connected' | 'disconnected' | 'error';
  mt5: 'connected' | 'disconnected' | 'error';
}

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, any>;
}
```

## 🎯 Langkah Implementasi

1. **Buat struktur folder** sesuai di atas
2. **Install dependencies** dengan `npm install`
3. **Build native modules** dengan `npm run rebuild`
4. **Konfigurasi environment** dan API credentials
5. **Run development server** dengan `npm run dev`
6. **Build untuk production** dengan `npm run build`
7. **Package aplikasi** dengan `npm run package:win`

## 📝 Catatan Penting

- Pastikan semua dependencies terinstall dengan benar
- ZeroMQ memerlukan build tools yang terinstall
- Aplikasi membutuhkan permission administrator untuk install ke folder MT5
- API credentials harus disimpan dengan aman menggunakan encryption