# 🖥️ FX Platform Windows Executor

> **Status:** ✅ **Production Ready** | **Version:** 1.0.0 | **Build:** Verified

Automated trading bridge between FX Platform and MetaTrader 5 with **100% automatic installation** and **advanced strategy execution**.

## ✨ Key Features

- 🔧 **One-Click Installation** - Automatically detects and installs to all MT5 instances
- 📦 **Single File Distribution** - Download one installer, everything is included
- 🚀 **ZeroMQ Bridge** - Real-time communication with MT5
- 📡 **Pusher Integration** - Receive commands from web platform instantly
- 🛡️ **Built-in Safety** - Position sizing, risk management, and monitoring
- 🔄 **Auto-Recovery** - Automatic reconnection and error handling
- 📊 **Real-time Monitoring** - Live trading status and performance metrics

## 🚀 Quick Start - Just 3 Steps!

### Step 1: Download & Install (1 minute)
1. Download `FX-Platform-Executor-Setup.exe` from the releases page
2. Run as Administrator (required for MT5 integration)
3. Click "Install" - everything is configured automatically

### Step 2: Launch & Configure (30 seconds)
1. Launch FX Platform Executor from desktop shortcut
2. Enter your API credentials from the web platform
3. Click "Connect" - connection established instantly

### Step 3: Start Trading! 🎉
- All MT5 instances are automatically configured
- Expert Advisor is installed and attached
- Real-time monitoring is active
- You're ready to receive trading signals!

## 📚 Documentation

> **[📖 Complete Documentation Index](./DOCUMENTATION_INDEX.md)** - All docs organized by role

### Quick Access:
- ✅ **[Production Status](./PRODUCTION_READY_CONFIRMED.md)** - Deployment verification
- 🔍 **[Gap Analysis](./WEB_PLATFORM_VS_EXECUTOR_GAP_ANALYSIS.md)** - Feature audit
- 🛠️ **[Setup Guide](./SETUP_GUIDE.md)** - Installation guide
- 💻 **[Developer Guide](./DEVELOPER.md)** - Dev documentation
- 🔌 **[API Reference](./API_ENDPOINTS_REFERENCE.md)** - API docs
- ⚡ **[ZeroMQ Setup](./LIBZMQ_SETUP.md)** - MT5 bridge

## 🔧 What Happens Automatically?

### During Installation:
✅ Detects all MT5 installations (standard, broker-specific, portable)  
✅ Installs libzmq.dll libraries for both 32-bit and 64-bit  
✅ Installs ZeroMQ Expert Advisor in all MT5 instances  
✅ Creates configuration files with optimal settings  
✅ Sets up auto-attach scripts for immediate trading  
✅ Creates desktop and start menu shortcuts  
✅ Configures auto-update service  

### After Setup:
✅ Establishes secure connection to FX Platform  
✅ Starts real-time command monitoring via Pusher  
✅ Initializes ZeroMQ bridge for MT5 communication  
✅ Begins heartbeat monitoring for connection health  
✅ Activates safety monitoring and risk management  

## 📁 Installation Structure

```
FX Platform Executor/
├── FX-Platform-Executor.exe      # Main application
├── resources/
│   ├── libs/
│   │   ├── libzmq-x64.dll        # 64-bit ZeroMQ library
│   │   └── libzmq-x86.dll        # 32-bit ZeroMQ library
│   ├── experts/
│   │   ├── ZeroMQBridge.mq5      # Expert Advisor source
│   │   └── ZeroMQBridge.ex5      # Compiled Expert Advisor
│   └── icons/
│       └── icon.ico              # Application icon
├── data/
│   ├── config.json               # Application configuration
│   ├── logs/                     # Application logs
│   └── backup/                   # Backup of MT5 files
└── uninstall.exe                 # Uninstaller
```

## 🔐 Security Features

### 🔒 Secure Communication
- Encrypted API key storage using Windows Credential Manager
- TLS/SSL encryption for all web communications
- ZeroMQ uses TCP with optional encryption
- Automatic credential rotation support

### 🛡️ Safety Mechanisms
- Maximum drawdown protection (configurable)
- Position size limits per symbol
- Account balance monitoring
- Emergency stop functionality
- Automatic position closure on connection loss

### 📝 Audit Trail
- Complete logging of all trading activities
- Command execution history
- Performance metrics tracking
- Error reporting and recovery actions

## 🎯 Core Components

### 📡 Pusher Service
- Real-time command reception from web platform
- Automatic reconnection with exponential backoff
- Message validation and filtering
- Command queuing and prioritization

### 🔌 ZeroMQ Bridge
- High-performance communication with MT5
- REQ/REP pattern for reliable command execution
- Automatic connection pooling
- Message serialization and compression

### 🤖 Expert Advisor
- Full MT5 MQL5 integration
- Order management (open/close/modify)
- Position monitoring and reporting
- Market data streaming
- Risk management enforcement

### 📊 Monitoring Dashboard
- Real-time connection status
- Active positions and P&L
- Performance metrics
- Error monitoring and alerts
- System health indicators

## 🔧 Advanced Configuration

### Connection Settings
```json
{
  "pusher": {
    "appKey": "your-pusher-key",
    "cluster": "your-cluster",
    "channel": "fx-platform-commands"
  },
  "zeromq": {
    "port": 5555,
    "host": "tcp://localhost",
    "timeout": 5000
  },
  "mt5": {
    "maxPositionsPerSymbol": 5,
    "defaultLots": 0.01,
    "magicNumber": 12345
  }
}
```

### Safety Settings
```json
{
  "riskManagement": {
    "maxDrawdownPercent": 10.0,
    "maxDailyLossPercent": 5.0,
    "maxPositionsPerSymbol": 5,
    "requireConfirmation": false,
    "emergencyStopEnabled": true
  }
}
```

## 🚨 Troubleshooting

### Common Issues & Solutions

#### "MT5 Not Found"
**Problem**: Application can't detect MetaTrader 5 installation  
**Solution**: 
1. Ensure MT5 is properly installed
2. Run FX Platform Executor as Administrator
3. Check if MT5 is installed in unusual location

#### "Permission Denied"
**Problem**: Can't write to MT5 directories  
**Solution**: 
1. Right-click and "Run as Administrator"
2. Check User Account Control (UAC) settings
3. Verify antivirus isn't blocking the application

#### "Connection Failed"
**Problem**: Can't connect to FX Platform  
**Solution**: 
1. Verify API credentials are correct
2. Check internet connection
3. Ensure firewall allows outbound connections
4. Verify Pusher API key is valid

#### "EA Not Working"
**Problem**: Expert Advisor not responding to commands  
**Solution**: 
1. Check if EA is enabled in MT5 (Tools → Options → Expert Advisors)
2. Verify "Allow algorithmic trading" is enabled
3. Ensure DLL imports are allowed in MT5
4. Restart MT5 terminal

### Debug Mode

Enable debug logging by creating `debug.log` in application directory:

```json
{
  "logging": {
    "level": "debug",
    "file": "debug.log",
    "console": true
  }
}
```

### Log Locations
- **Application Logs**: `%APPDATA%/FX Platform Executor/logs/`
- **MT5 Expert Logs**: MT5 Terminal → Experts tab
- **System Logs**: Windows Event Viewer → Application Logs

## 📈 Performance Metrics

### System Requirements
- **OS**: Windows 10/11 (64-bit recommended)
- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: 500MB free space
- **Network**: Stable internet connection
- **MT5**: Build 2000+ (any broker)

### Performance Benchmarks
- **Startup Time**: < 3 seconds
- **Command Latency**: < 100ms (local), < 500ms (remote)
- **Memory Usage**: < 100MB idle, < 200MB active
- **CPU Usage**: < 5% during normal operation
- **Auto-Installation**: < 30 seconds per MT5 instance

## 🔄 Auto-Update

The application includes automatic update capabilities:
- Checks for updates on startup
- Downloads and installs updates automatically
- Preserves configuration and settings
- Rollback capability for failed updates

## 📞 Support

### Getting Help
- **Documentation**: [FX Platform Docs](https://docs.fxfx.nusanexus.com)
- **Support Portal**: [support.fxfx.nusanexus.com](https://support.fxfx.nusanexus.com)
- **Community Forum**: [forum.fxfx.nusanexus.com](https://forum.fxfx.nusanexus.com)
- **Email Support**: support@fxfx.nusanexus.com

### Reporting Issues
When reporting issues, please include:
1. Windows version and build
2. MT5 version and broker
3. Application version
4. Error logs (from logs directory)
5. Steps to reproduce the issue

## 📄 License & Legal

- **License**: MIT License
- **Copyright**: © 2024 FX Platform Team
- **Disclaimer**: Trading involves risk. Past performance is not indicative of future results.
- **Privacy**: We don't store or share your trading data. All data remains on your local machine.

## 🚀 Version History

### v1.0.0 (Current)
- ✅ Full automatic MT5 detection and installation
- ✅ ZeroMQ bridge implementation
- ✅ Pusher real-time integration
- ✅ Complete safety and monitoring system
- ✅ Single-file distribution with auto-updater
- ✅ Comprehensive error handling and recovery

### Upcoming Features
- 📱 Mobile companion app
- 🤖 AI-powered strategy optimization
- 📊 Advanced analytics dashboard
- 🔗 Multi-broker support
- 🌐 Cloud backup and sync

---

**Made with ❤️ by the FX Platform Team**

*Your automated trading partner for professional Forex trading*