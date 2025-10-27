# Windows Executor V2 🚀

**Next-generation hybrid trading executor with Python backend and Electron UI**

## 🎯 Overview

Windows Executor V2 is a complete rewrite that eliminates the complexity of ZeroMQ and MetaTrader Expert Advisors, replacing them with a clean hybrid architecture:

- **Python FastAPI Backend** - Direct MT5 integration via Python API
- **Electron UI** - Modern, reactive interface built with React
- **100% Web Platform Compatible** - Execute strategies from your web dashboard
- **Advanced Trading Features** - Smart exits, partial exits, dynamic risk, regime detection, MTF analysis

## ✨ Key Features

### Core Trading
- ✅ **Direct MT5 Integration** - No EA required, pure Python MetaTrader5 API
- ✅ **Real-time Strategy Execution** - Evaluate conditions and execute trades
- ✅ **Full Indicator Support** - EMA, SMA, RSI, MACD, ATR, CCI, Bollinger Bands, ADX, Stochastic, SAR, OBV
- ✅ **Advanced Conditions** - Nested AND/OR logic, crossovers, comparisons

### Advanced Features
- 🎯 **Smart Exits** - ATR-based stops, support/resistance detection, Fibonacci targets
- 📊 **Enhanced Partial Exits** - Sequential/parallel exits with R:R ratio triggers
- ⚡ **Dynamic Risk Management** - Kelly Criterion, ATR-based, volatility-based sizing
- 🌐 **Market Regime Detection** - Adapt strategies to trending/ranging/volatile markets
- 📈 **Multi-Timeframe Analysis** - H4/D1 confirmation for better signals
- 📰 **News Filter** - Economic calendar integration with blackout periods
- 🔗 **Correlation Filter** - Multi-symbol correlation checks
- 🕐 **Session Filter** - Trade only during optimal market sessions
- 📉 **Spread & Volatility Filters** - Pre-execution validation

### Infrastructure
- 💾 **SQLite Database** - Local persistence for strategies and trades
- 🔄 **Pusher Integration** - Real-time command reception from web platform
- 🌐 **REST API** - Full backend API for UI and external integrations
- 📊 **Web Platform Reporting** - Automatic trade reporting back to dashboard

## 📦 Installation

### Prerequisites

1. **Python 3.11+** - [Download Python](https://python.org)
2. **Node.js 18+** - [Download Node.js](https://nodejs.org)
3. **MetaTrader 5** - [Download MT5](https://www.metatrader5.com/en/download)
4. **TA-Lib** - Required for technical indicators

### TA-Lib Installation

**Windows:**
```bash
# Download TA-Lib binary from:
# https://github.com/cgohlke/talib-build/releases
# Install the .whl file matching your Python version:
pip install TA_Lib-0.4.28-cp311-cp311-win_amd64.whl
```

**Linux/Mac:**
```bash
# Install TA-Lib C library
brew install ta-lib  # macOS
sudo apt-get install libta-lib0-dev  # Ubuntu/Debian

# Install Python wrapper
pip install TA-Lib
```

### Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create database
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"
```

### Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Build Electron app
npm run build
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your settings:
```env
# Pusher Configuration (get from your web platform)
WE_V2_PUSHER_KEY=your_pusher_key
WE_V2_PUSHER_CLUSTER=ap1
WE_V2_PUSHER_CHANNEL=private-executor-{your_id}

# Executor ID
WE_V2_EXECUTOR_ID=executor_001

# Platform API (optional - for reporting back)
WE_V2_PLATFORM_API_URL=https://your-platform.com
WE_V2_PLATFORM_API_KEY=your_api_key
```

## 🚀 Running

### Quick Start (Windows)

```bash
# Run startup script
start.bat
```

This will:
1. Start Python backend on `http://localhost:8081`
2. Start Electron UI automatically
3. Connect to MT5 (auto-detection)
4. Subscribe to Pusher commands

### Quick Start (Linux/Mac)

```bash
# Make script executable
chmod +x start.sh

# Run startup script
./start.sh
```

### Manual Start

**Backend:**
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload
```

**Frontend:**
```bash
cd frontend
npm run electron
```

## 📊 Architecture

```
┌─────────────────────────────────────────────────┐
│           WEB PLATFORM                          │
│  - Strategy Builder                             │
│  - Backtest Engine                              │
│  - User Dashboard                               │
└────────────┬────────────────────────────────────┘
             │
             │ Pusher WebSocket
             │ (command-received)
             │
             ↓
┌────────────────────────────────────────────────┐
│   PYTHON BACKEND (FastAPI)                     │
│  ┌──────────────────────────────────────────┐  │
│  │ Strategy Executor                        │  │
│  │  - Condition Evaluation                  │  │
│  │  - Indicator Calculation (TA-Lib)        │  │
│  │  - Risk Management                       │  │
│  │  - Trade Execution                       │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ Advanced Features                        │  │
│  │  - Smart Exits                           │  │
│  │  - Partial Exits                         │  │
│  │  - Dynamic Risk                          │  │
│  │  - Regime Detection                      │  │
│  │  - MTF Analysis                          │  │
│  │  - News/Correlation Filters              │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ REST API (/api/*)                        │  │
│  └──────────────────────────────────────────┘  │
└────────────┬───────────────────────────────────┘
             │
             │ REST API (localhost:8081)
             │
             ↓
┌────────────────────────────────────────────────┐
│   ELECTRON UI (React)                          │
│  - Dashboard                                   │
│  - Account Info                                │
│  - Active Strategies                           │
│  - Open Positions                              │
│  - Settings                                    │
└────────────────────────────────────────────────┘

             ↓
┌────────────────────────────────────────────────┐
│   MT5 TERMINAL                                 │
│  - Broker Connection                           │
│  - Price Feed                                  │
│  - Order Execution                             │
└────────────────────────────────────────────────┘
```

## 🔧 API Endpoints

### Health Check
```
GET /api/health
```

### Account Information
```
GET /api/account
```

### Strategies
```
GET /api/strategies          # List active strategies
POST /api/strategies         # Start strategy (via Pusher command)
DELETE /api/strategies/:id   # Stop strategy
```

### Trades
```
GET /api/trades/open         # Get open positions
GET /api/trades/history      # Get trade history
```

### System
```
GET /api/system              # System information
```

## 📝 Strategy Format

Strategies are sent from the web platform via Pusher:

```json
{
  "command": "START_STRATEGY",
  "parameters": {
    "strategyId": "strategy_123",
    "strategyName": "EMA Scalping Pro",
    "symbol": "EURUSD",
    "timeframe": "M15",
    "rules": {
      "entry": {
        "logic": "OR",
        "conditions": [
          {
            "indicator": "ema_9",
            "condition": "crosses_above",
            "value": "ema_21"
          }
        ]
      },
      "exit": {
        "stopLoss": { "type": "pips", "value": 25 },
        "takeProfit": { "type": "pips", "value": 40 },
        "smartExit": {
          "enabled": true,
          "stopLoss": { "type": "atr", "atrMultiplier": 2.0 },
          "takeProfit": { "type": "rr_ratio", "rrRatio": 2.5 }
        }
      },
      "riskManagement": {
        "lotSize": 0.01,
        "maxPositions": 3
      },
      "sessionFilter": {
        "enabled": true,
        "allowedSessions": ["London", "NewYork"]
      },
      "spreadFilter": {
        "enabled": true,
        "maxSpread": 2
      }
    }
  }
}
```

## 🧪 Testing

```bash
cd backend

# Run all tests
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=html

# Run specific test
python -m pytest tests/test_strategy_executor.py -v
```

## 📚 Project Structure

```
windows-executor-v2/
├── backend/                    # Python Backend
│   ├── api/                    # REST API endpoints
│   │   ├── account.py
│   │   ├── health.py
│   │   ├── strategies.py
│   │   ├── trades.py
│   │   └── system.py
│   ├── core/                   # Core business logic
│   │   ├── mt5_client.py       # MT5 integration
│   │   ├── pusher_client.py    # Pusher WebSocket
│   │   ├── strategy_executor.py # Strategy execution
│   │   ├── condition_evaluator.py
│   │   ├── risk_manager.py
│   │   ├── smart_exits.py      # Smart exit management
│   │   ├── partial_exits.py    # Partial exit management
│   │   ├── dynamic_risk.py     # Dynamic position sizing
│   │   ├── regime_detector.py  # Market regime detection
│   │   ├── mtf_analyzer.py     # Multi-timeframe analysis
│   │   ├── news_filter.py      # News filter
│   │   ├── correlation_filter.py
│   │   └── platform_api.py     # Platform reporting
│   ├── indicators/             # Technical indicators
│   │   └── talib_wrapper.py    # TA-Lib wrapper
│   ├── filters/                # Strategy filters
│   │   ├── session_filter.py
│   │   ├── spread_filter.py
│   │   └── volatility_filter.py
│   ├── models/                 # Pydantic data models
│   ├── database/               # Database layer
│   │   ├── connection.py
│   │   └── models.py
│   ├── utils/                  # Utilities
│   │   └── logger.py
│   ├── tests/                  # Unit tests
│   ├── main.py                 # FastAPI app
│   ├── config.py               # Configuration
│   └── requirements.txt
├── frontend/                   # Electron UI
│   ├── electron/
│   │   ├── main.ts             # Electron main
│   │   └── preload.ts          # IPC bridge
│   ├── src/
│   │   ├── app/
│   │   │   └── App.tsx         # Main UI
│   │   ├── components/
│   │   └── types/
│   ├── package.json
│   └── tsconfig.json
├── installer/                  # Build scripts
│   └── build-installer.js
├── .env.example                # Environment template
├── start.bat                   # Windows startup
├── start.sh                    # Linux/Mac startup
└── README.md
```

## 🛠️ Development

### Backend Development

```bash
cd backend

# Run with auto-reload
python -m uvicorn main:app --reload --log-level debug

# Format code
black .

# Type checking
mypy .

# Linting
ruff check .
```

### Frontend Development

```bash
cd frontend

# Run dev server
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build
```

## 📦 Building Distribution

### Windows Installer

```bash
cd installer
node build-installer.js
```

This will create:
- `windows-executor-v2-setup.exe` - Full installer with Python embedded
- `windows-executor-v2-portable.zip` - Portable version

### Requirements for Distribution
- Embedded Python 3.11+
- All dependencies bundled
- Auto-start on Windows boot (optional)
- System tray icon
- Auto-update support

## 🐛 Troubleshooting

### MT5 Not Found
```
ERROR: MT5 not found automatically
```
**Solution:** Set `WE_V2_MT5_PATH` in `.env` to your MT5 installation path.

### TA-Lib Import Error
```
ImportError: DLL load failed while importing _ta_lib
```
**Solution:** Install TA-Lib binary from [cgohlke/talib-build](https://github.com/cgohlke/talib-build/releases)

### Backend Not Starting
```
[Errno 10048] error while attempting to bind on address
```
**Solution:** Port 8081 is already in use. Change `WE_V2_API_PORT` in `.env`.

### Frontend Can't Connect
```
Network Error
```
**Solution:** Ensure backend is running on `http://localhost:8081`. Check `WE_V2_BACKEND_URL`.

## 📄 License

MIT License - see LICENSE file

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## 📞 Support

- Documentation: See `docs/` directory
- Issues: GitHub Issues
- Discussion: GitHub Discussions

---

**Built with ❤️ for the trading community**
