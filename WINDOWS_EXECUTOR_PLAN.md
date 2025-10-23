# 🖥️ WINDOWS EXECUTOR - RANCANGAN IMPLEMENTASI LENGKAP

**Tanggal Dibuat**: 2025-10-23  
**Versi**: 1.0.0  
**Status**: FINAL PLAN

---

## 📋 RINGKASAN EKSEKUTIF

Aplikasi Windows Executor adalah software desktop **FULL-AUTOMATED** yang berfungsi sebagai jembatan antara Web Platform dan MetaTrader 5/4. Aplikasi ini dirancang dengan filosofi **"Install and Forget"** - user tidak perlu melakukan konfigurasi teknis apapun.

### 🎯 Fitur Utama (100% OTOMATIS):

1. **🤖 Auto-Detection & Installation** 
   - Otomatis mendeteksi SEMUA instalasi MT5 (Program Files, AppData, portable, dll)
   - Otomatis scan Windows Registry untuk broker-specific installations
   - Otomatis install libzmq.dll (32-bit & 64-bit) ke MQL5/Libraries
   - Otomatis install Expert Advisor (.ex5 dan .mq5) ke MQL5/Experts
   - Otomatis buat file konfigurasi untuk EA
   - Otomatis backup file existing sebelum overwrite
   - Otomatis verify installation success

2. **⚡ Zero-Configuration Setup** 
   - User hanya perlu input API Key dan Secret (dari web platform)
   - Tidak ada folder yang perlu dicari manually
   - Tidak ada file yang perlu dicopy manual
   - Tidak ada setting teknis yang perlu diubah
   - Setup selesai dalam < 2 menit!

3. **🔗 Komunikasi Real-time** 
   - Menggunakan Pusher untuk menerima command instant
   - Auto-reconnection jika koneksi terputus
   - Heartbeat otomatis setiap 60 detik
   - Latency < 200ms untuk eksekusi trade

4. **🚀 Eksekusi Trade** 
   - Mengirim perintah trading ke MT5 via ZeroMQ
   - Support semua command: OPEN, CLOSE, MODIFY, PAUSE, RESUME, EMERGENCY_STOP
   - Priority queue untuk command critical
   - Retry logic untuk failed commands

5. **📊 Monitoring & Safety** 
   - Real-time monitoring koneksi dan trade
   - Safety limits (daily loss, max positions, max lot)
   - Emergency stop button
   - Detailed activity log
   - Auto-recovery dari crashes

---

## 🎯 TUJUAN UTAMA

### Untuk User:
- ✅ **100% OTOMATIS** - Setup mudah dalam 2 langkah (Install App → Input API Key)
- ✅ **ZERO MANUAL CONFIGURATION** - Semua otomatis terdeteksi dan terinstall
- ✅ **libzmq.dll otomatis** terinstall ke MQL5/Libraries
- ✅ **Expert Advisor otomatis** terinstall ke MQL5/Experts
- ✅ **EA otomatis aktif** di chart (optional auto-attach)
- ✅ Monitoring real-time status koneksi
- ✅ Safety button untuk emergency stop

### Untuk Platform:
- ✅ Koneksi stabil antara web dan MT5
- ✅ Latency rendah untuk eksekusi trade
- ✅ Reliable command delivery
- ✅ Automatic reconnection

---

## 🏗️ ARSITEKTUR APLIKASI

```
┌─────────────────────────────────────────────────────────────────┐
│                    WINDOWS EXECUTOR APP                         │
│                    (Electron + Node.js)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐       ┌────────────────────┐          │
│  │   UI Layer         │       │   Config Manager   │          │
│  │   (React)          │◄──────┤   (Settings)       │          │
│  └────────────────────┘       └────────────────────┘          │
│           │                             │                       │
│           ▼                             ▼                       │
│  ┌────────────────────────────────────────────────────┐        │
│  │              Core Services Layer                   │        │
│  ├────────────────────────────────────────────────────┤        │
│  │                                                    │        │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐│        │
│  │  │ Pusher Client│  │ REST Client  │  │ Heartbeat││        │
│  │  │ (Commands)   │  │ (API Calls)  │  │ Service  ││        │
│  │  └──────────────┘  └──────────────┘  └─────────┘│        │
│  │         │                  │               │      │        │
│  │         └──────────────────┼───────────────┘      │        │
│  │                            │                      │        │
│  │  ┌─────────────────────────▼──────────────────┐  │        │
│  │  │      Command Processor & Queue             │  │        │
│  │  │      (Priority Queue, Validation)          │  │        │
│  │  └─────────────────────────┬──────────────────┘  │        │
│  │                            │                      │        │
│  │  ┌─────────────────────────▼──────────────────┐  │        │
│  │  │         ZeroMQ Bridge                      │  │        │
│  │  │         (MT5 Communication)                │  │        │
│  │  └─────────────────────────┬──────────────────┘  │        │
│  │                            │                      │        │
│  │  ┌─────────────────────────▼──────────────────┐  │        │
│  │  │    Safety & Monitoring Module              │  │        │
│  │  │    (Limits, Emergency Stop, Logs)          │  │        │
│  │  └────────────────────────────────────────────┘  │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                 │
│  ┌────────────────────────────────────────────────────┐        │
│  │         Auto-Installation Module                   │        │
│  │         (Detect MT5, Copy libzmq.dll)              │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ ZeroMQ Protocol
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  METATRADER 5 TERMINAL                          │
│                  (Expert Advisor + ZeroMQ Server)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 TECHNOLOGY STACK

### Windows Application
- **Framework**: Electron 28+ (untuk cross-platform support)
- **UI**: React 18+ + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Real-time**: Pusher.js
- **ZeroMQ**: zeromq.js (node-gyp compiled)
- **Local DB**: SQLite3 (untuk logging dan cache)
- **Logging**: Winston
- **Packaging**: electron-builder

### Alternative Stack (Pure C#)
- **Framework**: WPF atau WinForms .NET 8
- **Real-time**: PusherClient (NuGet)
- **ZeroMQ**: NetMQ (NuGet)
- **HTTP**: HttpClient
- **Local DB**: SQLite (System.Data.SQLite)

**Rekomendasi**: Gunakan **Electron** untuk kemudahan development dan maintenance, karena platform web sudah menggunakan TypeScript/Node.js.

---

## 🚀 FITUR UTAMA

### 1. Auto-Installation Module (FULL AUTOMATION)

#### Deteksi MT5 & Auto-Install Everything
```typescript
interface MT5Info {
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

class MT5AutoInstaller {
  private progressCallback: (progress: InstallProgress) => void;

  constructor(progressCallback?: (progress: InstallProgress) => void) {
    this.progressCallback = progressCallback || (() => {});
  }

  /**
   * MAIN AUTO-INSTALLATION FUNCTION
   * Detects MT5, installs libzmq.dll AND Expert Advisor automatically
   */
  async autoInstallEverything(): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      mt5Installations: [],
      componentsInstalled: {
        libzmq: false,
        expertAdvisor: false,
        configFile: false,
      },
      errors: [],
    };

    try {
      // Step 1: Detect MT5 installations
      this.progressCallback({ step: 1, message: 'Detecting MT5 installations...' });
      const installations = await this.detectMT5Installations();
      
      if (installations.length === 0) {
        throw new Error('MetaTrader 5 not found. Please install MT5 first.');
      }

      result.mt5Installations = installations;
      this.progressCallback({ 
        step: 2, 
        message: `Found ${installations.length} MT5 installation(s)` 
      });

      // Step 2: Install to all detected MT5 instances
      for (const mt5 of installations) {
        this.progressCallback({ 
          step: 3, 
          message: `Installing components to: ${mt5.path}` 
        });

        // Install libzmq.dll
        const libzmqSuccess = await this.installLibZMQ(mt5);
        result.componentsInstalled.libzmq = libzmqSuccess;

        if (!libzmqSuccess) {
          result.errors.push(`Failed to install libzmq.dll to ${mt5.path}`);
        }

        // Install Expert Advisor
        const eaSuccess = await this.installExpertAdvisor(mt5);
        result.componentsInstalled.expertAdvisor = eaSuccess;

        if (!eaSuccess) {
          result.errors.push(`Failed to install Expert Advisor to ${mt5.path}`);
        }

        // Create EA configuration file
        const configSuccess = await this.createEAConfigFile(mt5);
        result.componentsInstalled.configFile = configSuccess;
      }

      // Step 4: Auto-attach EA to chart (if MT5 is running)
      if (installations[0].isRunning) {
        this.progressCallback({ 
          step: 4, 
          message: 'Auto-attaching EA to chart...' 
        });
        await this.autoAttachEAToChart(installations[0]);
      }

      result.success = true;
      this.progressCallback({ 
        step: 5, 
        message: '✓ Installation completed successfully!' 
      });

    } catch (error) {
      result.errors.push(error.message);
      this.progressCallback({ 
        step: -1, 
        message: `✗ Installation failed: ${error.message}` 
      });
    }

    return result;
  }

  /**
   * Detect all MT5 installations on the system
   */
  async detectMT5Installations(): Promise<MT5Info[]> {
    const installations: MT5Info[] = [];
    
    // Check common installation paths
    const possiblePaths = [
      'C:\\Program Files\\MetaTrader 5',
      'C:\\Program Files (x86)\\MetaTrader 5',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MetaTrader 5'),
    ];

    // Also check registry for broker-specific installations
    const registryPaths = await this.getRegistryMT5Paths();
    possiblePaths.push(...registryPaths);

    // Check AppData for portable installations
    const appDataPath = path.join(process.env.APPDATA || '', 'MetaQuotes', 'Terminal');
    if (await fs.pathExists(appDataPath)) {
      const terminals = await fs.readdir(appDataPath);
      for (const terminal of terminals) {
        const terminalPath = path.join(appDataPath, terminal);
        possiblePaths.push(terminalPath);
      }
    }

    // Scan all paths
    for (const basePath of possiblePaths) {
      try {
        if (await this.isMT5Installed(basePath)) {
          const info = await this.getMT5Info(basePath);
          installations.push(info);
        }
      } catch (error) {
        console.warn(`Error checking ${basePath}:`, error);
      }
    }

    // Remove duplicates
    return this.deduplicateInstallations(installations);
  }

  /**
   * Get MT5 installation paths from Windows Registry
   */
  private async getRegistryMT5Paths(): Promise<string[]> {
    const paths: string[] = [];
    
    try {
      // Using node-winreg to read registry
      const Registry = require('winreg');
      const regKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
      });

      const items = await new Promise<any[]>((resolve, reject) => {
        regKey.keys((err: any, items: any[]) => {
          if (err) reject(err);
          else resolve(items);
        });
      });

      for (const item of items) {
        const values = await new Promise<any[]>((resolve) => {
          item.values((err: any, values: any[]) => {
            resolve(values || []);
          });
        });

        const displayName = values.find(v => v.name === 'DisplayName')?.value || '';
        const installLocation = values.find(v => v.name === 'InstallLocation')?.value;

        if (displayName.includes('MetaTrader 5') && installLocation) {
          paths.push(installLocation);
        }
      }
    } catch (error) {
      console.warn('Could not read registry:', error);
    }

    return paths;
  }

  /**
   * Check if path contains a valid MT5 installation
   */
  private async isMT5Installed(basePath: string): Promise<boolean> {
    const terminal64 = path.join(basePath, 'terminal64.exe');
    const terminal = path.join(basePath, 'terminal.exe');
    
    return await fs.pathExists(terminal64) || await fs.pathExists(terminal);
  }

  /**
   * Get detailed MT5 information
   */
  private async getMT5Info(basePath: string): Promise<MT5Info> {
    const terminal64 = path.join(basePath, 'terminal64.exe');
    const terminal = path.join(basePath, 'terminal.exe');
    const terminalPath = await fs.pathExists(terminal64) ? terminal64 : terminal;

    // Get version from executable
    const version = await this.getFileVersion(terminalPath);
    const build = await this.getBuildNumber(terminalPath);

    // Determine data path (where MQL5 folder is)
    let dataPath = basePath;
    
    // Check if it's installed in Program Files (data is in AppData)
    if (basePath.includes('Program Files')) {
      const appDataPath = path.join(process.env.APPDATA || '', 'MetaQuotes', 'Terminal');
      const terminals = await fs.readdir(appDataPath).catch(() => []);
      
      // Find matching terminal by comparing installation
      for (const terminal of terminals) {
        const terminalDataPath = path.join(appDataPath, terminal);
        const originPath = path.join(terminalDataPath, 'origin.txt');
        
        if (await fs.pathExists(originPath)) {
          const origin = await fs.readFile(originPath, 'utf-8');
          if (origin.trim() === basePath) {
            dataPath = terminalDataPath;
            break;
          }
        }
      }
    }

    const libraryPath = path.join(dataPath, 'MQL5', 'Libraries');
    const expertsPath = path.join(dataPath, 'MQL5', 'Experts');

    // Create directories if they don't exist
    await fs.ensureDir(libraryPath);
    await fs.ensureDir(expertsPath);

    // Check if MT5 is currently running
    const isRunning = await this.isMT5Running();

    // Try to detect broker and account
    const broker = await this.detectBroker(dataPath);
    const accountNumber = await this.detectAccountNumber(dataPath);

    return {
      path: basePath,
      dataPath,
      version,
      build,
      libraryPath,
      expertsPath,
      isRunning,
      broker,
      accountNumber,
    };
  }

  /**
   * Install libzmq.dll to MT5 Libraries folder
   */
  async installLibZMQ(mt5: MT5Info): Promise<boolean> {
    try {
      // Determine architecture (32-bit or 64-bit)
      const is64bit = await fs.pathExists(path.join(mt5.path, 'terminal64.exe'));
      const libName = is64bit ? 'libzmq-x64.dll' : 'libzmq-x86.dll';
      
      const libzmqSource = path.join(process.resourcesPath, 'libs', libName);
      const libzmqDest = path.join(mt5.libraryPath, 'libzmq.dll');
      
      // Check if already installed and up-to-date
      if (await fs.pathExists(libzmqDest)) {
        const sourceHash = await this.getFileHash(libzmqSource);
        const destHash = await this.getFileHash(libzmqDest);
        
        if (sourceHash === destHash) {
          console.log('✓ libzmq.dll already installed and up to date');
          return true;
        }

        // Create backup
        const backupPath = `${libzmqDest}.backup.${Date.now()}`;
        await fs.copy(libzmqDest, backupPath);
        console.log(`Created backup: ${backupPath}`);
      }

      // Copy file
      await fs.copy(libzmqSource, libzmqDest);
      console.log(`✓ libzmq.dll installed to ${libzmqDest}`);
      
      // Verify installation
      return await fs.pathExists(libzmqDest);
      
    } catch (error) {
      console.error('Failed to install libzmq.dll:', error);
      
      // Check for permission issues
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        throw new Error('Permission denied. Please run as Administrator.');
      }
      
      return false;
    }
  }

  /**
   * Install Expert Advisor to MT5 Experts folder
   */
  async installExpertAdvisor(mt5: MT5Info): Promise<boolean> {
    try {
      const eaSource = path.join(process.resourcesPath, 'experts', 'FX_Platform_Bridge.ex5');
      const eaDest = path.join(mt5.expertsPath, 'FX_Platform_Bridge.ex5');
      
      // Check if already installed
      if (await fs.pathExists(eaDest)) {
        const sourceHash = await this.getFileHash(eaSource);
        const destHash = await this.getFileHash(eaDest);
        
        if (sourceHash === destHash) {
          console.log('✓ Expert Advisor already installed and up to date');
          return true;
        }

        // Create backup
        const backupPath = `${eaDest}.backup.${Date.now()}`;
        await fs.copy(eaDest, backupPath);
      }

      // Copy EA file
      await fs.copy(eaSource, eaDest);
      console.log(`✓ Expert Advisor installed to ${eaDest}`);

      // Also copy the source file (.mq5) if available for user reference
      const mq5Source = path.join(process.resourcesPath, 'experts', 'FX_Platform_Bridge.mq5');
      if (await fs.pathExists(mq5Source)) {
        const mq5Dest = path.join(mt5.expertsPath, 'FX_Platform_Bridge.mq5');
        await fs.copy(mq5Source, mq5Dest);
        console.log(`✓ EA source file (.mq5) also copied`);
      }

      return true;
      
    } catch (error) {
      console.error('Failed to install Expert Advisor:', error);
      return false;
    }
  }

  /**
   * Create EA configuration file
   */
  async createEAConfigFile(mt5: MT5Info): Promise<boolean> {
    try {
      const config = {
        executorId: await configManager.get('executorId'),
        apiKey: await configManager.get('apiKey'),
        zmqPort: 5555,
        zmqHost: 'tcp://localhost',
        autoReconnect: true,
        heartbeatInterval: 60,
      };

      const configPath = path.join(mt5.expertsPath, 'FX_Platform_Bridge.json');
      await fs.writeJson(configPath, config, { spaces: 2 });
      
      console.log(`✓ Configuration file created at ${configPath}`);
      return true;
      
    } catch (error) {
      console.error('Failed to create configuration file:', error);
      return false;
    }
  }

  /**
   * Auto-attach EA to chart (Advanced feature)
   * This uses MT5 automation to attach EA automatically
   */
  async autoAttachEAToChart(mt5: MT5Info): Promise<boolean> {
    try {
      // This is an advanced feature that requires MT5 API or COM automation
      // We'll create a script file that MT5 can execute
      
      const scriptContent = `
//+------------------------------------------------------------------+
//| Auto-attach script for FX Platform Bridge EA                     |
//+------------------------------------------------------------------+
void OnStart()
{
   // Find EURUSD chart or create one
   long chartId = ChartFirst();
   bool found = false;
   
   while(chartId >= 0)
   {
      if(ChartSymbol(chartId) == "EURUSD")
      {
         found = true;
         break;
      }
      chartId = ChartNext(chartId);
   }
   
   // If not found, create new chart
   if(!found)
   {
      chartId = ChartOpen("EURUSD", PERIOD_H1);
   }
   
   // Attach EA to chart
   if(chartId > 0)
   {
      ChartSetInteger(chartId, CHART_BRING_TO_TOP, true);
      
      // The EA needs to be attached manually or via terminal automation
      Print("Chart ready for EA attachment");
      
      // Alternative: Use ChartApplyTemplate to apply a template with EA
      string templatePath = TerminalInfoString(TERMINAL_DATA_PATH) + 
                           "\\templates\\FX_Platform_Default.tpl";
      if(ChartApplyTemplate(chartId, templatePath))
      {
         Print("EA attached successfully via template");
      }
   }
}
`;

      // Save script
      const scriptPath = path.join(mt5.dataPath, 'MQL5', 'Scripts', 'AutoAttachEA.mq5');
      await fs.writeFile(scriptPath, scriptContent);

      // Also create a template file with EA preset
      await this.createEATemplate(mt5);

      console.log('✓ Auto-attach script created');
      
      // Note: Actual execution would require MT5 terminal automation
      // which is platform-specific and may require additional libraries
      
      return true;
      
    } catch (error) {
      console.error('Failed to create auto-attach script:', error);
      return false;
    }
  }

  /**
   * Create MT5 template with EA preset
   */
  private async createEATemplate(mt5: MT5Info): Promise<void> {
    const templateContent = `
<chart>
  chart_type=1
  scale=4
  graph=1
  fore=0
  grid=1
  volume=0
  scroll=1
  shift=1
  ohlc=0
  </chart>

<expert>
  name=FX_Platform_Bridge
  flags=279
  window_num=0
  </expert>
`;

    const templatePath = path.join(mt5.dataPath, 'templates', 'FX_Platform_Default.tpl');
    await fs.ensureDir(path.dirname(templatePath));
    await fs.writeFile(templatePath, templateContent);
  }

  /**
   * Check if MT5 is currently running
   */
  private async isMT5Running(): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq terminal64.exe" /FO CSV /NH');
      return stdout.includes('terminal64.exe');
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper: Get file version from executable
   */
  private async getFileVersion(filePath: string): Promise<string> {
    // Implementation would use Windows API or external tool
    // For now, return placeholder
    return '5.0';
  }

  /**
   * Helper: Get build number from executable
   */
  private async getBuildNumber(filePath: string): Promise<number> {
    // Implementation would parse file info
    return 3815;
  }

  /**
   * Helper: Calculate file hash for comparison
   */
  private async getFileHash(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Helper: Detect broker name from MT5 data
   */
  private async detectBroker(dataPath: string): Promise<string | undefined> {
    try {
      const serverFile = path.join(dataPath, 'config', 'server.dat');
      if (await fs.pathExists(serverFile)) {
        // Parse server configuration (simplified)
        const content = await fs.readFile(serverFile, 'utf-8');
        // Extract broker name (implementation would parse the file)
        return 'IC Markets'; // Placeholder
      }
    } catch (error) {
      console.warn('Could not detect broker:', error);
    }
    return undefined;
  }

  /**
   * Helper: Detect account number
   */
  private async detectAccountNumber(dataPath: string): Promise<string | undefined> {
    try {
      const accountsPath = path.join(dataPath, 'config', 'accounts.dat');
      if (await fs.pathExists(accountsPath)) {
        // Parse accounts file (implementation would parse binary format)
        return '12345678'; // Placeholder
      }
    } catch (error) {
      console.warn('Could not detect account:', error);
    }
    return undefined;
  }

  /**
   * Helper: Remove duplicate installations
   */
  private deduplicateInstallations(installations: MT5Info[]): MT5Info[] {
    const seen = new Set<string>();
    return installations.filter(install => {
      const key = install.path.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Types
interface InstallProgress {
  step: number;
  message: string;
}

interface InstallResult {
  success: boolean;
  mt5Installations: MT5Info[];
  componentsInstalled: {
    libzmq: boolean;
    expertAdvisor: boolean;
    configFile: boolean;
  };
  errors: string[];
}
```

### 2. Simple Configuration UI

#### Setup Wizard (3 Steps)

**Step 1: Welcome & Auto-Installation**
```
┌────────────────────────────────────────┐
│   FX Trading Platform - Executor Setup │
├────────────────────────────────────────┤
│                                        │
│   📊 Welcome to Executor Setup         │
│                                        │
│   We'll automatically setup everything │
│   for you. Just sit back and relax!    │
│                                        │
│   ⏳ Detecting MT5 installations...    │
│                                        │
│   ✓ Found: MetaTrader 5 (Build 3815)  │
│   ✓ Path: C:\Program Files\MT5\        │
│                                        │
│   ⏳ Installing components...          │
│   ✓ libzmq.dll → MQL5/Libraries/       │
│   ✓ FX_Platform_Bridge.ex5 → Experts/  │
│   ✓ Configuration file created         │
│                                        │
│   🎉 All set! Click Next to continue   │
│                                        │
│              [Next →]                  │
└────────────────────────────────────────┘
```

**Step 2: API Credentials**
```
┌────────────────────────────────────────┐
│   API Configuration                    │
├────────────────────────────────────────┤
│                                        │
│   Enter your API credentials from:    │
│   https://platform.com/executors       │
│                                        │
│   API Key:                             │
│   ┌──────────────────────────────┐   │
│   │ exe_1234567890abcdef         │   │
│   └──────────────────────────────┘   │
│                                        │
│   API Secret:                          │
│   ┌──────────────────────────────┐   │
│   │ ••••••••••••••••••••••••••   │   │
│   └──────────────────────────────┘   │
│                                        │
│   [Test Connection]  [Save & Next]    │
│                                        │
│   ⓘ Your credentials are encrypted    │
│      and stored locally.               │
│                                        │
└────────────────────────────────────────┘
```

**Step 3: Final Check & Auto-Start**
```
┌────────────────────────────────────────┐
│   Ready to Trade!                      │
├────────────────────────────────────────┤
│                                        │
│   ✓ MT5 detected and configured       │
│   ✓ libzmq.dll installed               │
│   ✓ Expert Advisor installed           │
│   ✓ API connection established         │
│                                        │
│   📋 Next Steps (Automatic):           │
│                                        │
│   The Expert Advisor is ready in MT5  │
│   under: Experts/FX_Platform_Bridge    │
│                                        │
│   [✓] Auto-attach EA to EURUSD chart   │
│   [✓] Start monitoring automatically   │
│                                        │
│   ⓘ If MT5 is running, we'll attach   │
│      the EA automatically. Otherwise,  │
│      just drag it to any chart.        │
│                                        │
│   [Start Executor]                     │
│                                        │
└────────────────────────────────────────┘
```

### 3. Main Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  FX Platform Executor                    [_][□][×]           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Status: ● ONLINE          MT5: ● CONNECTED                 │
│  Executor: My MT5 Account  Last Heartbeat: 2s ago           │
│                                                              │
│  ┌────────────────────┬────────────────────┬──────────────┐│
│  │ Active Strategies  │ Open Positions     │ Today P&L    ││
│  │       3            │        5           │  +$127.50    ││
│  └────────────────────┴────────────────────┴──────────────┘│
│                                                              │
│  Recent Activity:                            [🔄] [⚙️] [🛑] │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✓ 14:23:45  EURUSD BUY 0.01 @ 1.0950                │  │
│  │ ✓ 14:22:10  Strategy "Scalper v1" activated         │  │
│  │ ✓ 14:20:33  Heartbeat sent - OK                     │  │
│  │ ℹ 14:18:00  Connected to platform                   │  │
│  │ ℹ 14:17:55  MT5 connection established              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Performance Summary:                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Win Rate: 65%       Profit Factor: 1.8              │  │
│  │  Total Trades: 47    Avg. Trade: +$8.50             │  │
│  │  Max Drawdown: -2.3% Sharpe Ratio: 1.45             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [View Strategies]  [View Trades]  [Settings]  [Emergency]  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  MT5: Build 3815 | Broker: IC Markets | Balance: $10,250    │
└──────────────────────────────────────────────────────────────┘
```

### 4. Pusher Integration (Real-time Commands)

```typescript
class PusherService {
  private pusher: Pusher;
  private channel: Channel;
  
  async connect(apiKey: string, executorId: string) {
    this.pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      encrypted: true,
      authEndpoint: `${API_BASE_URL}/api/pusher/auth`,
      auth: {
        headers: {
          'X-API-Key': apiKey,
          'X-API-Secret': await this.getSecret(),
        },
      },
    });

    // Subscribe to private executor channel
    this.channel = this.pusher.subscribe(`private-executor-${executorId}`);
    
    // Bind to command events
    this.channel.bind('command-received', this.handleCommand.bind(this));
    this.channel.bind('pusher:subscription_succeeded', () => {
      console.log('✓ Pusher connected');
      this.updateConnectionStatus('online');
    });
    
    this.channel.bind('pusher:subscription_error', (error: any) => {
      console.error('✗ Pusher connection error:', error);
      this.updateConnectionStatus('error');
    });
  }
  
  private async handleCommand(data: Command) {
    console.log('Command received:', data);
    
    // Validate command
    if (!this.isValidCommand(data)) {
      await this.reportCommandResult(data.id, 'failed', {
        success: false,
        message: 'Invalid command format',
      });
      return;
    }
    
    // Add to queue
    await commandQueue.add(data);
  }
}
```

### 5. Command Processor & Queue

```typescript
interface Command {
  id: string;
  command: string;
  parameters?: Record<string, any>;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
}

class CommandProcessor {
  private queue: PriorityQueue<Command>;
  private processing: boolean = false;
  
  constructor() {
    this.queue = new PriorityQueue((a, b) => 
      this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority)
    );
  }
  
  async add(command: Command) {
    // Log received command
    await logger.info('Command received', { commandId: command.id, type: command.command });
    
    // Add to queue
    this.queue.enqueue(command);
    
    // Start processing if not already
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  private async processQueue() {
    this.processing = true;
    
    while (!this.queue.isEmpty()) {
      const command = this.queue.dequeue()!;
      
      try {
        // Execute command
        const result = await this.executeCommand(command);
        
        // Report success
        await this.reportResult(command.id, 'executed', result);
        
      } catch (error) {
        // Report failure
        await this.reportResult(command.id, 'failed', {
          success: false,
          message: error.message,
        });
      }
    }
    
    this.processing = false;
  }
  
  private async executeCommand(command: Command): Promise<any> {
    switch (command.command) {
      case 'OPEN_POSITION':
        return await this.openPosition(command.parameters);
      
      case 'CLOSE_POSITION':
        return await this.closePosition(command.parameters);
      
      case 'CLOSE_ALL_POSITIONS':
        return await this.closeAllPositions();
      
      case 'PAUSE':
        return await this.pauseTrading();
      
      case 'RESUME':
        return await this.resumeTrading();
      
      case 'EMERGENCY_STOP':
        return await this.emergencyStop();
      
      default:
        throw new Error(`Unknown command: ${command.command}`);
    }
  }
}
```

### 6. ZeroMQ Bridge to MT5

```typescript
class ZeroMQBridge {
  private socket: zmq.Socket;
  private connected: boolean = false;
  
  async connect(host: string = 'tcp://localhost:5555') {
    this.socket = zmq.socket('req'); // Request socket
    
    this.socket.on('message', this.handleResponse.bind(this));
    this.socket.on('error', this.handleError.bind(this));
    
    this.socket.connect(host);
    
    // Test connection
    const isConnected = await this.ping();
    this.connected = isConnected;
    
    return isConnected;
  }
  
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendRequest({ command: 'PING' });
      return response.status === 'OK';
    } catch (error) {
      return false;
    }
  }
  
  async openPosition(params: {
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    stopLoss?: number;
    takeProfit?: number;
    comment?: string;
  }): Promise<TradeResult> {
    const request = {
      command: 'OPEN_POSITION',
      ...params,
    };
    
    const response = await this.sendRequest(request);
    
    if (response.success) {
      // Report to platform
      await this.reportTrade({
        ticket: response.ticket,
        ...params,
        openPrice: response.openPrice,
        openTime: new Date().toISOString(),
      });
    }
    
    return response;
  }
  
  private async sendRequest(request: any, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);
      
      // Send request
      this.socket.send(JSON.stringify(request));
      
      // Wait for response
      this.socket.once('message', (msg: Buffer) => {
        clearTimeout(timer);
        try {
          const response = JSON.parse(msg.toString());
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}
```

### 7. Heartbeat Service

```typescript
class HeartbeatService {
  private interval: NodeJS.Timeout | null = null;
  private intervalMs: number = 60000; // 60 seconds
  
  start() {
    if (this.interval) {
      this.stop();
    }
    
    // Send first heartbeat immediately
    this.sendHeartbeat();
    
    // Schedule periodic heartbeats
    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);
  }
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  private async sendHeartbeat() {
    try {
      const config = await configManager.getConfig();
      const mt5Info = await mt5Bridge.getAccountInfo();
      
      const payload = {
        status: 'online',
        metadata: {
          version: app.getVersion(),
          platform: config.platform,
          accountBalance: mt5Info.balance,
          accountEquity: mt5Info.equity,
          openPositions: mt5Info.openPositions,
          cpuUsage: await this.getCPUUsage(),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        },
      };
      
      const response = await axios.post(
        `${API_BASE_URL}/api/executor/${config.executorId}/heartbeat`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.apiKey,
            'X-API-Secret': await this.getSecret(),
          },
          timeout: 10000,
        }
      );
      
      if (response.data.success) {
        logger.debug('Heartbeat sent successfully');
        
        // Check for pending commands (fallback)
        if (response.data.pendingCommands?.length > 0) {
          for (const command of response.data.pendingCommands) {
            await commandProcessor.add(command);
          }
        }
      }
      
    } catch (error) {
      logger.error('Heartbeat failed:', error);
      // Retry logic
      setTimeout(() => this.sendHeartbeat(), 5000);
    }
  }
}
```

### 8. Safety & Monitoring Module

```typescript
class SafetyModule {
  private limits: SafetyLimits;
  private monitoring: boolean = true;
  
  constructor() {
    this.limits = {
      maxDailyLoss: 500,
      maxPositions: 10,
      maxLotSize: 1.0,
      maxDrawdownPercent: 20,
    };
  }
  
  async checkBeforeTrade(params: TradeParams): Promise<SafetyCheck> {
    const checks: SafetyCheck = {
      passed: true,
      warnings: [],
      errors: [],
    };
    
    // Check daily loss limit
    const todayPnL = await this.getTodayPnL();
    if (todayPnL <= -this.limits.maxDailyLoss) {
      checks.passed = false;
      checks.errors.push('Daily loss limit reached');
    }
    
    // Check max positions
    const openPositions = await mt5Bridge.getOpenPositionsCount();
    if (openPositions >= this.limits.maxPositions) {
      checks.passed = false;
      checks.errors.push('Maximum open positions reached');
    }
    
    // Check lot size
    if (params.volume > this.limits.maxLotSize) {
      checks.passed = false;
      checks.errors.push(`Lot size exceeds maximum (${this.limits.maxLotSize})`);
    }
    
    // Check drawdown
    const drawdown = await this.getCurrentDrawdown();
    if (drawdown >= this.limits.maxDrawdownPercent) {
      checks.passed = false;
      checks.errors.push('Maximum drawdown reached');
    }
    
    // Warnings
    if (todayPnL < 0) {
      checks.warnings.push(`Current daily loss: $${Math.abs(todayPnL).toFixed(2)}`);
    }
    
    return checks;
  }
  
  async emergencyStop(): Promise<void> {
    logger.warn('EMERGENCY STOP activated');
    
    // Stop receiving new commands
    await commandProcessor.pause();
    
    // Close all positions
    const positions = await mt5Bridge.getAllPositions();
    for (const position of positions) {
      try {
        await mt5Bridge.closePosition(position.ticket);
      } catch (error) {
        logger.error(`Failed to close position ${position.ticket}:`, error);
      }
    }
    
    // Pause all strategies
    await this.pauseAllStrategies();
    
    // Notify platform
    await this.notifyEmergencyStop();
    
    // Show UI alert
    dialog.showMessageBox({
      type: 'warning',
      title: 'Emergency Stop',
      message: 'All positions have been closed and trading has been stopped.',
      buttons: ['OK'],
    });
  }
}
```

---

## 📂 PROJECT STRUCTURE

```
windows-executor/
├── electron/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Preload script
│   └── installer.ts               # Auto-installer for libzmq.dll
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

---

## 🔧 INSTALASI & DEVELOPMENT

### Prerequisites
```bash
# Node.js 18+
node --version

# npm atau yarn
npm --version

# Python (untuk node-gyp)
python --version

# Visual Studio Build Tools (Windows)
# Download dari: https://visualstudio.microsoft.com/downloads/
```

### Setup Development
```bash
# Clone repository
git clone <repo-url>
cd windows-executor

# Install dependencies
npm install

# Build native modules (zeromq)
npm run rebuild

# Run development
npm run dev

# Build for production
npm run build

# Package for Windows
npm run package:win
```

### Build Configuration (`electron-builder.json`)
```json
{
  "appId": "com.fxplatform.executor",
  "productName": "FX Platform Executor",
  "directories": {
    "output": "dist"
  },
  "win": {
    "target": ["nsis", "portable"],
    "icon": "resources/icons/icon.ico",
    "requestedExecutionLevel": "requireAdministrator"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  },
  "extraResources": [
    {
      "from": "resources/libs",
      "to": "libs"
    },
    {
      "from": "resources/experts",
      "to": "experts"
    }
  ]
}
```

---

## 🔐 SECURITY IMPLEMENTATION

### 1. Credential Storage
```typescript
// Menggunakan electron-store dengan encryption
import Store from 'electron-store';
import { safeStorage } from 'electron';

const store = new Store({
  encryptionKey: 'your-encryption-key', // Auto-generated per installation
});

class ConfigManager {
  async saveCredentials(apiKey: string, apiSecret: string) {
    // Encrypt secret
    const encryptedSecret = safeStorage.encryptString(apiSecret);
    
    store.set('apiKey', apiKey);
    store.set('apiSecret', encryptedSecret.toString('base64'));
  }
  
  async getSecret(): Promise<string> {
    const encrypted = store.get('apiSecret') as string;
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  }
}
```

### 2. API Communication
```typescript
// Semua komunikasi menggunakan HTTPS
// Headers terenkripsi
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': config.apiKey,
  'X-API-Secret': await this.getSecret(),
  'User-Agent': `FX-Executor/${app.getVersion()}`,
};
```

### 3. Local Database Encryption
```typescript
// SQLite dengan SQLCipher
import SQLite from 'better-sqlite3';
import SQLCipher from '@journeyapps/sqlcipher';

const db = new SQLCipher('executor.db', {
  key: await this.getEncryptionKey(),
});
```

---

## 🧪 TESTING STRATEGY

### Unit Tests
```typescript
// services/__tests__/pusher.service.test.ts
describe('PusherService', () => {
  it('should connect to Pusher', async () => {
    const service = new PusherService();
    await service.connect('test-key', 'test-executor-id');
    expect(service.isConnected()).toBe(true);
  });
  
  it('should handle commands', async () => {
    const service = new PusherService();
    const command = { id: '123', command: 'PAUSE' };
    await service.handleCommand(command);
    // Assert command was processed
  });
});
```

### Integration Tests
```typescript
// integration/__tests__/zeromq.test.ts
describe('ZeroMQ Integration', () => {
  it('should send trade command to MT5', async () => {
    const bridge = new ZeroMQBridge();
    await bridge.connect();
    
    const result = await bridge.openPosition({
      symbol: 'EURUSD',
      type: 'BUY',
      volume: 0.01,
    });
    
    expect(result.success).toBe(true);
    expect(result.ticket).toBeDefined();
  });
});
```

### E2E Tests
```typescript
// e2e/__tests__/full-flow.test.ts
describe('Full Trading Flow', () => {
  it('should complete full trade cycle', async () => {
    // 1. Setup
    await app.start();
    await app.configure({ apiKey: 'test', apiSecret: 'test' });
    
    // 2. Connect
    await app.connect();
    expect(app.isConnected()).toBe(true);
    
    // 3. Receive command
    await pusher.sendCommand({ command: 'OPEN_POSITION' });
    
    // 4. Verify execution
    const trades = await app.getTrades();
    expect(trades).toHaveLength(1);
  });
});
```

---

## 📊 MONITORING & LOGGING

### Winston Logger Configuration
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // File logging
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});
```

### SQLite Logging
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(10),
  category VARCHAR(50),
  message TEXT,
  metadata TEXT,
  INDEX idx_timestamp (timestamp),
  INDEX idx_level (level)
);

CREATE TABLE command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id VARCHAR(255) UNIQUE,
  command_type VARCHAR(50),
  status VARCHAR(20),
  received_at DATETIME,
  executed_at DATETIME,
  result TEXT,
  INDEX idx_command_id (command_id),
  INDEX idx_received_at (received_at)
);
```

---

## 🚀 DEPLOYMENT & DISTRIBUTION

### Build Process
```bash
# 1. Clean build
npm run clean

# 2. Install production dependencies
npm ci --production

# 3. Build TypeScript
npm run build

# 4. Build native modules
npm run rebuild

# 5. Package application
npm run package:win

# Output: dist/FX-Platform-Executor-Setup-1.0.0.exe
```

### Auto-Update Configuration
```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-org',
  repo: 'fx-executor',
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. Download now?',
    buttons: ['Yes', 'No'],
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});
```

### Installer (NSIS) Customization
```nsis
!macro customInstall
  ; Install Visual C++ Redistributable
  File "vc_redist.x64.exe"
  ExecWait '"$INSTDIR\vc_redist.x64.exe" /quiet /norestart'
  
  ; Detect and install libzmq.dll to MT5
  nsExec::ExecToLog '"$INSTDIR\resources\app.asar.unpacked\installer.exe" --detect-mt5'
!macroend
```

---

## 📈 PERFORMANCE OPTIMIZATION

### 1. Command Queue Optimization
```typescript
// Use in-memory queue for speed
// Persist to SQLite for reliability
class OptimizedCommandQueue {
  private memoryQueue: Command[] = [];
  private db: Database;
  
  async add(command: Command) {
    // Add to memory first
    this.memoryQueue.push(command);
    
    // Async persist to DB
    setImmediate(() => {
      this.db.run(
        'INSERT INTO command_queue (id, data) VALUES (?, ?)',
        [command.id, JSON.stringify(command)]
      );
    });
  }
  
  async get(): Promise<Command | null> {
    // Get from memory first
    if (this.memoryQueue.length > 0) {
      const command = this.memoryQueue.shift()!;
      
      // Remove from DB
      setImmediate(() => {
        this.db.run('DELETE FROM command_queue WHERE id = ?', [command.id]);
      });
      
      return command;
    }
    
    // Fallback to DB
    return this.getFromDatabase();
  }
}
```

### 2. ZeroMQ Connection Pooling
```typescript
class ZeroMQPool {
  private pool: ZeroMQBridge[] = [];
  private maxConnections = 3;
  
  async getConnection(): Promise<ZeroMQBridge> {
    // Reuse existing connection
    for (const conn of this.pool) {
      if (!conn.isBusy()) {
        return conn;
      }
    }
    
    // Create new connection if under limit
    if (this.pool.length < this.maxConnections) {
      const conn = new ZeroMQBridge();
      await conn.connect();
      this.pool.push(conn);
      return conn;
    }
    
    // Wait for available connection
    return this.waitForConnection();
  }
}
```

---

## ⚠️ ERROR HANDLING & RECOVERY

### Auto-Reconnection Logic
```typescript
class ConnectionManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  
  async handleDisconnection(type: 'pusher' | 'zeromq' | 'api') {
    logger.warn(`${type} disconnected, attempting reconnection...`);
    
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        await this.reconnect(type);
        logger.info(`${type} reconnected successfully`);
        this.reconnectAttempts = 0;
        return true;
        
      } catch (error) {
        this.reconnectAttempts++;
        logger.error(
          `Reconnection attempt ${this.reconnectAttempts} failed:`,
          error
        );
        
        // Exponential backoff
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        await this.sleep(Math.min(delay, 60000)); // Max 1 minute
      }
    }
    
    // Failed to reconnect
    logger.error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
    this.notifyUser('Connection lost. Please restart the application.');
    return false;
  }
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Core Infrastructure & AUTO-INSTALLER (Week 1-2)
- [ ] Setup Electron project structure
- [ ] **Implement full auto-installer module**:
  - [ ] MT5 detection (all installations)
  - [ ] Registry scanning for broker-specific installs
  - [ ] AppData portable installations detection
  - [ ] Auto-install libzmq.dll (32-bit & 64-bit support)
  - [ ] Auto-install Expert Advisor (.ex5 and .mq5)
  - [ ] Auto-create EA configuration file
  - [ ] Auto-attach EA to chart (optional)
  - [ ] Progress callback for UI feedback
- [ ] Create configuration manager with encryption
- [ ] Setup SQLite database
- [ ] Implement logging system

### Phase 2: Communication Layer (Week 3-4)
- [ ] Implement REST API client
- [ ] Implement Pusher client
- [ ] Implement heartbeat service
- [ ] Implement ZeroMQ bridge
- [ ] Create command processor and queue
- [ ] Add error handling and reconnection logic

### Phase 3: Safety & Monitoring (Week 5)
- [ ] Implement safety checks
- [ ] Create emergency stop functionality
- [ ] Add position monitoring
- [ ] Implement daily loss limits
- [ ] Add drawdown monitoring

### Phase 4: User Interface (Week 6-7)
- [ ] Create setup wizard (3 steps)
- [ ] Create main dashboard
- [ ] Create settings page
- [ ] Create logs viewer
- [ ] Add system tray integration
- [ ] Implement notifications

### Phase 5: MT5 Expert Advisor (Week 8)
- [ ] Create ZeroMQ server in MQL5
- [ ] Implement order execution logic
- [ ] Add error handling
- [ ] Create account info reporting
- [ ] Test with demo account

### Phase 6: Testing & QA (Week 9-10)
- [ ] Unit tests for all services
- [ ] Integration tests
- [ ] E2E tests
- [ ] Load testing
- [ ] Security audit
- [ ] Demo account testing

### Phase 7: Deployment (Week 11-12)
- [ ] Setup CI/CD pipeline
- [ ] Create installer
- [ ] Implement auto-update
- [ ] Write documentation
- [ ] Create video tutorials
- [ ] Beta testing with users
- [ ] Production release

---

## 🎓 USER DOCUMENTATION

### Quick Start Guide (SUPER SIMPLE!)
```markdown
# Getting Started with FX Platform Executor

## ⚡ AUTOMATED SETUP - Just 2 Steps!

### Step 1: Install Application (1 minute)
1. Download FX-Platform-Executor-Setup.exe
2. Run installer (requires Administrator)
3. Click Next → Next → Install
4. **DONE!** The app will automatically:
   ✓ Find your MT5 installation
   ✓ Install libzmq.dll to MQL5/Libraries
   ✓ Install Expert Advisor to MQL5/Experts
   ✓ Create configuration files

### Step 2: Enter API Credentials (30 seconds)
1. Get your API Key from: https://platform.com/dashboard/executors
2. Open FX Platform Executor app
3. Paste your API Key and Secret
4. Click "Connect"

## 🎉 That's It!

The executor is now running and ready to trade!

### Optional: Manual EA Attachment
If the EA wasn't automatically attached to a chart:
1. Open MetaTrader 5
2. Find "FX_Platform_Bridge" in Navigator → Expert Advisors
3. Drag it to any chart (EURUSD recommended)

### Need Help?
- Check the built-in status indicator (should show ● ONLINE)
- View activity log for connection status
- Contact support if any issues

---

## 📱 What Happens Automatically?

### During Installation:
✅ Detects ALL MT5 installations on your PC
✅ Copies libzmq.dll (correct version for 32/64-bit)
✅ Copies Expert Advisor files (.ex5 and .mq5)
✅ Creates EA configuration file
✅ Backs up any existing files
✅ Verifies installation success

### After You Enter API Key:
✅ Connects to platform via Pusher (real-time)
✅ Starts heartbeat (60-second intervals)
✅ Connects to MT5 via ZeroMQ
✅ Begins monitoring for trade signals
✅ Reports status back to platform

### You Don't Need To:
❌ Manually find MT5 folders
❌ Copy any DLL files yourself
❌ Edit any configuration files
❌ Restart MT5 (though recommended)
❌ Know anything about ZeroMQ or Pusher

---

## 🔧 Troubleshooting

### "MT5 Not Found"
→ Make sure MetaTrader 5 is installed
→ Try running as Administrator
→ Check: C:\Program Files\MetaTrader 5

### "Permission Denied"
→ Close MT5 terminal
→ Run executor as Administrator
→ Try again

### "EA Not Showing in MT5"
→ Restart MT5 terminal
→ Check: Navigator → Expert Advisors
→ The EA is named "FX_Platform_Bridge"

### "Connection Failed"
→ Check your internet connection
→ Verify API credentials
→ Check firewall settings (allow port 5555)
```

---

## 🔒 SECURITY BEST PRACTICES

### For Users:
1. Never share your API credentials
2. Keep the executor updated
3. Use strong Windows password
4. Enable Windows Firewall
5. Regular antivirus scans

### For Developers:
1. Encrypt all sensitive data
2. Use HTTPS for all API calls
3. Implement rate limiting
4. Validate all inputs
5. Log security events
6. Regular security audits
7. Keep dependencies updated

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

**Issue: Executor shows "Offline"**
- ✓ Check internet connection
- ✓ Verify API credentials
- ✓ Check firewall settings
- ✓ Restart application

**Issue: MT5 not detected**
- ✓ Ensure MT5 is installed
- ✓ Run as Administrator
- ✓ Check installation path

**Issue: Commands not executing**
- ✓ Check MT5 EA is running
- ✓ Verify ZeroMQ connection
- ✓ Check MT5 terminal logs
- ✓ Verify account permissions

---

## 🎯 SUCCESS CRITERIA

Aplikasi dianggap siap production ketika:

### 🚀 Auto-Installation (CRITICAL)
1. ✅ Auto-detect MT5 installations berhasil 100% (all install types)
2. ✅ Auto-install libzmq.dll berhasil 100% (32-bit & 64-bit)
3. ✅ Auto-install Expert Advisor berhasil 100%
4. ✅ Auto-create configuration files berhasil 100%
5. ✅ Backup existing files before overwriting
6. ✅ Handle permissions gracefully (prompt for Admin if needed)
7. ✅ Detect and handle multiple MT5 installations

### ⚡ Setup & Configuration
8. ✅ Complete setup dapat diselesaikan dalam < 2 menit (target: 90 seconds)
9. ✅ User hanya perlu input API Key dan Secret (zero manual config)
10. ✅ Test connection before saving credentials
11. ✅ Clear error messages with actionable solutions

### 🔌 Connectivity & Performance
12. ✅ Connection uptime > 99.9%
13. ✅ Command execution latency < 500ms (target: < 200ms)
14. ✅ Auto-reconnection berfungsi dengan baik
15. ✅ Pusher connection stable dan reliable
16. ✅ ZeroMQ bridge latency < 100ms

### 🛡️ Safety & Reliability
17. ✅ Emergency stop response time < 1 second
18. ✅ Zero duplicate trade orders
19. ✅ Safety limits enforced (daily loss, max positions, etc.)
20. ✅ Graceful handling of MT5 disconnections
21. ✅ Automatic recovery from crashes

### 🧪 Testing & Quality
22. ✅ Tested dengan > 1000 trades
23. ✅ Tested on multiple MT5 installations
24. ✅ Tested with various broker servers
25. ✅ Stress testing (high-frequency commands)
26. ✅ Security audit passed

### 📚 Documentation & Support
27. ✅ User documentation lengkap dan mudah dipahami
28. ✅ Video tutorials available
29. ✅ In-app help and tooltips
30. ✅ Support response time < 24 hours

### 📊 Metrics Target
- **Installation success rate**: > 99%
- **Setup completion time**: < 2 minutes
- **First trade latency**: < 5 seconds from signal
- **Uptime**: > 99.9%
- **User satisfaction**: > 4.5/5 stars

---

## 📝 CHANGELOG & VERSIONING

### Version 1.0.0 (Target: Q1 2025)
- Initial release
- Core features: Auto-install, Setup wizard, Pusher integration
- MT5 ZeroMQ bridge
- Basic safety features
- Dashboard and monitoring

### Version 1.1.0 (Target: Q2 2025)
- Advanced safety features
- Performance analytics
- Multiple executor support
- Cloud backup

---

## 📚 REFERENCES

- Electron Documentation: https://www.electronjs.org/docs
- Pusher Documentation: https://pusher.com/docs
- ZeroMQ Guide: https://zeromq.org/get-started/
- MQL5 Reference: https://www.mql5.com/en/docs
- electron-builder: https://www.electron.build/

---

---

## 🌟 KEUNGGULAN FULL-AUTOMATION APPROACH

### Untuk User:
✅ **Setup Ultra-Cepat**: < 2 menit dari install sampai trading  
✅ **Zero Technical Knowledge**: Tidak perlu tahu tentang DLL, folder MT5, atau ZeroMQ  
✅ **Zero Human Error**: Tidak ada kesalahan copy file atau salah folder  
✅ **Universal Compatibility**: Otomatis detect semua jenis instalasi MT5  
✅ **Safe & Secure**: Automatic backup sebelum overwrite  
✅ **Peace of Mind**: Jika gagal, jelas kenapa dan gimana fix-nya  

### Untuk Support Team:
✅ **Minimal Support Tickets**: 90% user tidak butuh bantuan  
✅ **Easy Troubleshooting**: Logs detail untuk debugging  
✅ **Self-Healing**: Banyak masalah bisa auto-resolve  
✅ **Clear Error Messages**: User tahu apa yang harus dilakukan  

### Untuk Development:
✅ **Single Codebase**: Semua logic dalam satu auto-installer module  
✅ **Easy Testing**: Mock MT5 installations untuk unit test  
✅ **Easy Updates**: Push update dan auto-install ke semua user  
✅ **Analytics Built-in**: Track installation success rate  

### Competitive Advantage:
✅ **Fastest Setup**: Kompetitor butuh 10-15 menit manual setup  
✅ **Best UX**: User tidak perlu baca dokumentasi panjang  
✅ **Professional**: Terlihat polished dan modern  
✅ **Scalable**: Bisa handle ribuan user tanpa overwhelm support  

---

## 💡 NEXT STEPS

1. **Setup Development Environment** (Day 1)
   - Install Node.js, Python, VS Build Tools
   - Setup Electron project
   - Configure dependencies

2. **Build Auto-Installer Prototype** (Week 1)
   - MT5 detection
   - File copy operations
   - Registry scanning
   - Test on multiple MT5 setups

3. **Implement Communication Layer** (Week 2-3)
   - Pusher integration
   - ZeroMQ bridge
   - Heartbeat service
   - Command processor

4. **Build UI** (Week 4-5)
   - Setup wizard
   - Main dashboard
   - Settings page
   - Activity log

5. **Testing & Refinement** (Week 6-8)
   - Unit tests
   - Integration tests
   - User acceptance testing
   - Bug fixes

6. **Deploy & Monitor** (Week 9+)
   - Beta release
   - Collect feedback
   - Monitor metrics
   - Iterate based on data

---

**END OF PLAN - READY FOR IMPLEMENTATION**

*Dokumen ini adalah rancangan final untuk Windows Executor Application dengan **FULL AUTOMATION**.*  
*Semua fitur dan arsitektur telah direncanakan dengan detail.*  
*Target: User setup dalam < 2 menit, installation success rate > 99%*  
*Siap untuk memulai development! 🚀*
