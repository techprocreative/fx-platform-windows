# Arsitektur Windows Executor Platform

## 🏗️ Diagram Arsitektur Sistem

### High-Level Architecture

```mermaid
graph TB
    subgraph "Web Platform"
        WP[Web Platform]
        API[REST API]
        PS[Pusher Service]
    end
    
    subgraph "Windows Executor App"
        subgraph "UI Layer"
            UI[React UI]
            Setup[Setup Wizard]
            Dashboard[Dashboard]
            Settings[Settings]
        end
        
        subgraph "Core Services"
            Pusher[Pusher Client]
            REST[REST Client]
            Heartbeat[Heartbeat Service]
            Command[Command Processor]
            Queue[Priority Queue]
            ZeroMQ[ZeroMQ Bridge]
            Safety[Safety Module]
            MT5Detect[MT5 Detector]
        end
        
        subgraph "Data Layer"
            Config[Config Manager]
            SQLite[(SQLite Database)]
            Logger[Winston Logger]
        end
    end
    
    subgraph "MetaTrader 5"
        MT5[MT5 Terminal]
        EA[Expert Advisor]
        ZMQServer[ZeroMQ Server]
    end
    
    WP --> API
    WP --> PS
    PS --> Pusher
    API --> REST
    UI --> Setup
    UI --> Dashboard
    UI --> Settings
    
    Pusher --> Command
    REST --> Heartbeat
    Command --> Queue
    Queue --> ZeroMQ
    ZeroMQ --> ZMQServer
    ZMQServer --> EA
    EA --> MT5
    
    Safety --> Command
    MT5Detect --> Config
    Config --> SQLite
    Command --> SQLite
    Heartbeat --> Logger
    Command --> Logger
```

### Auto-Installation Flow

```mermaid
flowchart TD
    Start([Aplikasi Dimulai]) --> CheckMT5{Cek MT5 Terinstall?}
    CheckMT5 -->|Tidak| ShowError[Tampilkan Error: Install MT5]
    CheckMT5 -->|Ya| ScanRegistry[Scan Windows Registry]
    ScanRegistry --> ScanPaths[Scan Common Paths]
    ScanPaths --> ScanAppData[Scan AppData Folder]
    ScanAppData --> FoundMT5[Dapatkan Daftar MT5]
    
    FoundMT5 --> InstallLibzmq[Install libzmq.dll]
    InstallLibzmq --> InstallEA[Install Expert Advisor]
    InstallEA --> CreateConfig[Buat Config File]
    CreateConfig --> VerifyInstall[Verifikasi Install]
    
    VerifyInstall --> Success{Install Berhasil?}
    Success -->|Ya| ShowSuccess[Tampilkan Success Message]
    Success -->|Tidak| ShowErrorInstall[Tampilkan Error Message]
    
    ShowSuccess --> NextStep[Langkah Berikutnya]
    ShowError --> End([Selesai])
    ShowErrorInstall --> End
    ShowErrorInstall --> Retry{Coba Lagi?}
    Retry -->|Ya| InstallLibzmq
    Retry -->|Tidak| End
```

### Command Processing Flow

```mermaid
sequenceDiagram
    participant Platform as Web Platform
    participant Pusher as Pusher Service
    participant Executor as Windows Executor
    participant Queue as Command Queue
    participant ZMQ as ZeroMQ Bridge
    participant MT5 as MetaTrader 5
    
    Platform->>Pusher: Send Command
    Pusher->>Executor: Push Command
    Executor->>Queue: Add to Queue
    Queue->>Queue: Sort by Priority
    
    loop Process Queue
        Queue->>Executor: Get Next Command
        Executor->>Safety: Check Safety Limits
        Safety-->>Executor: Safety Check Result
        
        alt Safety Passed
            Executor->>ZMQ: Send Command
            ZMQ->>MT5: Execute Trade
            MT5-->>ZMQ: Trade Result
            ZMQ-->>Executor: Execution Result
            Executor->>Platform: Report Result
        else Safety Failed
            Executor->>Platform: Report Safety Error
        end
    end
```

### Database Schema Relations

```mermaid
erDiagram
    CONFIG {
        int id PK
        string key UK
        text value
        boolean encrypted
        datetime created_at
        datetime updated_at
    }
    
    MT5_INSTALLATIONS {
        int id PK
        string path
        string data_path
        string version
        int build
        string library_path
        string experts_path
        boolean is_running
        string broker
        string account_number
        boolean is_active
        datetime created_at
        datetime updated_at
    }
    
    COMMAND_QUEUE {
        int id PK
        string command_id UK
        string command_type
        string priority
        string status
        text parameters
        datetime received_at
        datetime executed_at
        text result
        text error_message
        int retry_count
    }
    
    COMMAND_HISTORY {
        int id PK
        string command_id
        string command_type
        string status
        datetime received_at
        datetime executed_at
        datetime completed_at
        text result
        text error_message
        int execution_time_ms
    }
    
    TRADES {
        int id PK
        int ticket UK
        string symbol
        string type
        decimal volume
        decimal open_price
        decimal close_price
        datetime open_time
        datetime close_time
        decimal profit
        decimal commission
        decimal swap
        string comment
        int magic_number
        string status
    }
    
    ACTIVITY_LOGS {
        int id PK
        datetime timestamp
        string level
        string category
        text message
        text metadata
    }
    
    PERFORMANCE_METRICS {
        int id PK
        date date
        int total_trades
        int winning_trades
        int losing_trades
        decimal total_profit
        decimal total_loss
        decimal net_profit
        decimal win_rate
        decimal profit_factor
        decimal max_drawdown
        decimal sharpe_ratio
        datetime created_at
    }
    
    SAFETY_LIMITS {
        int id PK
        string name UK
        decimal value
        boolean is_enabled
        text description
        datetime created_at
        datetime updated_at
    }
    
    HEARTBEAT_LOGS {
        int id PK
        datetime timestamp
        string status
        int response_time_ms
        text metadata
    }
```

### Component Architecture

```mermaid
graph TB
    subgraph "Electron Main Process"
        Main[main.ts]
        IPC[IPC Handlers]
        Menu[Menu System]
        AutoUpdater[Auto Updater]
        Security[Security Manager]
    end
    
    subgraph "Renderer Process"
        subgraph "React App"
            App[App.tsx]
            Router[React Router]
            
            subgraph "Pages"
                Setup[Setup Wizard]
                Dashboard[Dashboard]
                Settings[Settings]
                Logs[Logs Viewer]
            end
            
            subgraph "Components"
                StatusBar[Status Bar]
                ActivityLog[Activity Log]
                PerformanceCard[Performance Card]
                EmergencyButton[Emergency Button]
            end
        end
        
        subgraph "State Management"
            AppStore[App Store]
            ConfigStore[Config Store]
            LogsStore[Logs Store]
        end
        
        subgraph "Services"
            PusherService[Pusher Service]
            APIService[API Service]
            HeartbeatService[Heartbeat Service]
            ZeroMQService[ZeroMQ Service]
            CommandService[Command Service]
            SafetyService[Safety Service]
            MT5Detector[MT5 Detector]
        end
    end
    
    subgraph "External Dependencies"
        PusherAPI[Pusher API]
        RESTAPI[REST API]
        ZeroMQLib[ZeroMQ Library]
        MT5Terminal[MT5 Terminal]
    end
    
    Main --> IPC
    IPC --> App
    App --> Router
    Router --> Setup
    Router --> Dashboard
    Router --> Settings
    Router --> Logs
    
    Setup --> AppStore
    Dashboard --> AppStore
    Settings --> ConfigStore
    Logs --> LogsStore
    
    AppStore --> PusherService
    AppStore --> APIService
    AppStore --> HeartbeatService
    AppStore --> CommandService
    CommandService --> ZeroMQService
    CommandService --> SafetyService
    Setup --> MT5Detector
    
    PusherService --> PusherAPI
    APIService --> RESTAPI
    ZeroMQService --> ZeroMQLib
    ZeroMQLib --> MT5Terminal
```

### Security Architecture

```mermaid
graph LR
    subgraph "Security Layers"
        subgraph "Application Security"
            SafeStorage[Electron SafeStorage]
            Encryption[AES Encryption]
            Validation[Input Validation]
        end
        
        subgraph "Network Security"
            HTTPS[HTTPS/TLS]
            APIAuth[API Authentication]
            RateLimit[Rate Limiting]
        end
        
        subgraph "Data Security"
            SQLCipher[SQLCipher DB]
            Hashing[Password Hashing]
            Backup[Encrypted Backup]
        end
    end
    
    subgraph "Threat Protection"
        subgraph "Common Threats"
            MITM[Man-in-the-Middle]
            Injection[SQL Injection]
            XSS[Cross-Site Scripting]
            CSRF[CSRF Attack]
        end
        
        subgraph "Protection Measures"
            CertValidation[Certificate Validation]
            ParameterizedQueries[Parameterized Queries]
            CSP[Content Security Policy]
            CSRFToken[CSRF Tokens]
        end
    end
    
    SafeStorage --> Encryption
    HTTPS --> CertValidation
    SQLCipher --> Backup
    
    MITM -.-> HTTPS
    Injection -.-> ParameterizedQueries
    XSS -.-> CSP
    CSRF -.-> CSRFToken
```

## 🔄 Data Flow Diagram

### Setup Flow

```mermaid
flowchart TD
    User([User]) --> LaunchApp[Launch App]
    LaunchApp --> CheckFirstRun{First Run?}
    CheckFirstRun -->|Yes| ShowSetup[Show Setup Wizard]
    CheckFirstRun -->|No| ShowDashboard[Show Dashboard]
    
    ShowSetup --> Step1[Step 1: Welcome]
    Step1 --> AutoDetect[Auto-Detect MT5]
    AutoDetect --> InstallComponents[Install Components]
    InstallComponents --> Step2[Step 2: API Credentials]
    Step2 --> TestConnection[Test Connection]
    TestConnection --> Step3[Step 3: Ready]
    Step3 --> ShowDashboard
    
    ShowDashboard --> StartServices[Start Background Services]
    StartServices --> ConnectPusher[Connect Pusher]
    ConnectPusher --> ConnectZeroMQ[Connect ZeroMQ]
    ConnectZeroMQ --> StartHeartbeat[Start Heartbeat]
    StartHeartbeat --> ReadyState[Ready State]
```

### Trading Command Flow

```mermaid
stateDiagram-v2
    [*] --> CommandReceived
    CommandReceived --> ValidateCommand: Validate
    ValidateCommand --> AddToQueue: Valid
    ValidateCommand --> ReportError: Invalid
    
    AddToQueue --> ProcessCommand: Process Queue
    ProcessCommand --> CheckSafety: Safety Check
    CheckSafety --> ExecuteCommand: Passed
    CheckSafety --> ReportSafetyError: Failed
    
    ExecuteCommand --> SendToMT5: Send via ZeroMQ
    SendToMT5 --> WaitForResponse: Wait Response
    WaitForResponse --> CommandSuccess: Success
    WaitForResponse --> CommandFailed: Failed/Timeout
    
    CommandSuccess --> ReportSuccess: Report to Platform
    CommandFailed --> ReportError: Report Error
    ReportSuccess --> [*]
    ReportError --> [*]
    ReportSafetyError --> [*]
```

## 📊 Performance Monitoring

### Metrics Collection

```mermaid
graph TB
    subgraph "Performance Metrics"
        subgraph "System Metrics"
            CPU[CPU Usage]
            Memory[Memory Usage]
            Disk[Disk I/O]
            Network[Network Latency]
        end
        
        subgraph "Application Metrics"
            ResponseTime[Command Response Time]
            QueueSize[Queue Size]
            ErrorRate[Error Rate]
            Uptime[Uptime]
        end
        
        subgraph "Trading Metrics"
            Latency[Trade Latency]
            SuccessRate[Success Rate]
            Volume[Trade Volume]
            PnL[Profit & Loss]
        end
    end
    
    subgraph "Monitoring Tools"
        Logger[Winston Logger]
        MetricsDB[(SQLite Metrics)]
        Dashboard[Performance Dashboard]
        Alerts[Alert System]
    end
    
    CPU --> Logger
    Memory --> Logger
    ResponseTime --> MetricsDB
    QueueSize --> MetricsDB
    Latency --> MetricsDB
    
    MetricsDB --> Dashboard
    Logger --> Dashboard
    Dashboard --> Alerts
```

## 🚀 Deployment Architecture

### Build Process

```mermaid
flowchart LR
    Source[Source Code] --> Build[Build Process]
    Build --> Test[Unit/Integration Tests]
    Test --> Package[Package Application]
    Package --> Sign[Code Signing]
    Sign --> Distribute[Distribution Channels]
    
    subgraph "Build Process"
        TypeScript[TypeScript Compilation]
        ViteBuild[Vite Build]
        ElectronBuild[Electron Build]
        NativeBuild[Native Modules]
    end
    
    subgraph "Distribution"
        NSIS[NSIS Installer]
        Portable[Portable Version]
        AutoUpdate[Auto Update Server]
    end
    
    Build --> TypeScript
    TypeScript --> ViteBuild
    ViteBuild --> ElectronBuild
    ElectronBuild --> NativeBuild
    
    Package --> NSIS
    Package --> Portable
    Sign --> AutoUpdate
```

## 📝 Kesimpulan

Diagram arsitektur ini memberikan visualisasi lengkap dari sistem Windows Executor Platform, mencakup:

1. **High-Level Architecture** - Hubungan antar komponen utama
2. **Auto-Installation Flow** - Proses otomatisasi instalasi MT5
3. **Command Processing** - Alur eksekusi perintah trading
4. **Database Relations** - Struktur database dan relasinya
5. **Component Architecture** - Struktur komponen aplikasi
6. **Security Architecture** - Lapisan keamanan sistem
7. **Data Flow** - Alur data dalam aplikasi
8. **Performance Monitoring** - Sistem monitoring performa
9. **Deployment Architecture** - Proses build dan distribusi

Dengan arsitektur yang well-designed ini, aplikasi akan memiliki:
- **Scalability** - Mudah dikembangkan
- **Maintainability** - Mudah dirawat
- **Security** - Aman dari berbagai ancaman
- **Performance** - Performa tinggi dan optimal
- **Reliability** - Handal dan stabil