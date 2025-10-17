# Executor Component - Windows Client & Expert Advisor

## Overview

Executor adalah komponen client-side yang bertanggung jawab untuk eksekusi trading real-time dengan latensi minimal. Terdiri dari aplikasi Windows yang berkomunikasi dengan Expert Advisor (EA) di MetaTrader 5 melalui ZeroMQ.

## Arsitektur Sistem

### Component Architecture

```
┌─────────────────────────────────────────┐
│         Windows Application              │
│            (Python)                      │
├─────────────────────────────────────────┤
│  • GUI (PyQt6)                         │
│  • Strategy Engine                     │
│  • Risk Manager                        │
│  • API Client                          │
│  • ZMQ Server                          │
└────────────┬───────────────────────────┘
             │
             │ ZeroMQ (localhost:5555)
             │ REQ/REP Pattern
             │
┌────────────▼───────────────────────────┐
│      MetaTrader 5 Terminal             │
│         Expert Advisor                 │  
├─────────────────────────────────────────┤
│  • Market Data Collection              │
│  • Order Execution                     │
│  • Position Management                 │
│  • ZMQ Client                         │
└─────────────────────────────────────────┘
```

## Windows Application

### Technology Stack

```yaml
Language: Python 3.9+
GUI Framework: PyQt6
Communication: ZeroMQ (PyZMQ)
HTTP Client: httpx (async)
Data Processing: 
  - NumPy (numerical computation)
  - Pandas (data manipulation)
  - TA-Lib (technical indicators)
Configuration: YAML/JSON
Logging: Python logging + Loguru
Packaging: PyInstaller
Auto-update: PyUpdater
```

### Project Structure

```
executor/
├── src/
│   ├── main.py                 # Application entry point
│   ├── app.py                  # Main application class
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py         # Configuration management
│   │   └── constants.py        # Application constants
│   ├── ui/
│   │   ├── __init__.py
│   │   ├── main_window.py      # Main window
│   │   ├── widgets/
│   │   │   ├── dashboard.py    # Dashboard widget
│   │   │   ├── positions.py    # Positions table
│   │   │   ├── charts.py       # Chart widget
│   │   │   └── logs.py         # Log viewer
│   │   └── dialogs/
│   │       ├── settings.py     # Settings dialog
│   │       └── login.py        # Login dialog
│   ├── core/
│   │   ├── __init__.py
│   │   ├── strategy_engine.py  # Strategy execution engine
│   │   ├── risk_manager.py     # Risk management
│   │   ├── indicators.py       # Technical indicators
│   │   └── order_manager.py    # Order management
│   ├── api/
│   │   ├── __init__.py
│   │   ├── client.py           # API client
│   │   ├── auth.py             # Authentication
│   │   └── models.py           # Data models
│   ├── mt5/
│   │   ├── __init__.py
│   │   ├── connector.py        # MT5 connector via ZMQ
│   │   ├── commands.py         # MT5 commands
│   │   └── parser.py           # Message parser
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── logger.py           # Logging utilities
│   │   ├── encryption.py       # Encryption utilities
│   │   └── helpers.py          # Helper functions
│   └── resources/
│       ├── icons/              # Application icons
│       ├── styles/             # QSS stylesheets
│       └── translations/       # i18n files
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── requirements.txt
├── setup.py
├── build.spec                   # PyInstaller spec
└── README.md
```

### Core Implementation

#### Main Application

```python
# src/main.py
import sys
import asyncio
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from src.app import TradingExecutor
from src.utils.logger import setup_logging

def main():
    # Setup logging
    setup_logging()
    
    # Enable high DPI support
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    QApplication.setAttribute(Qt.AA_EnableHighDpiScaling)
    QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps)
    
    # Create application
    app = QApplication(sys.argv)
    app.setApplicationName("NexusTrade Executor")
    app.setOrganizationName("NexusTrade")
    
    # Create and show main window
    executor = TradingExecutor()
    executor.show()
    
    # Run event loop
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
```

#### Strategy Engine

```python
# src/core/strategy_engine.py
import json
import asyncio
from typing import Dict, List, Optional
from dataclasses import dataclass
import numpy as np
import pandas as pd
from src.core.indicators import IndicatorCalculator
from src.core.risk_manager import RiskManager
from src.utils.logger import logger

@dataclass
class Signal:
    action: str  # BUY, SELL, CLOSE
    symbol: str
    lots: float
    stop_loss: Optional[float]
    take_profit: Optional[float]
    reason: str

class StrategyEngine:
    def __init__(self, strategy_json: dict):
        self.strategy = strategy_json
        self.indicator_calc = IndicatorCalculator()
        self.risk_manager = RiskManager()
        self.active_positions = {}
        
    async def evaluate(self, market_data: dict) -> Optional[Signal]:
        """Evaluate strategy conditions against market data"""
        try:
            symbol = market_data['symbol']
            candles = pd.DataFrame(market_data['candles'])
            
            # Calculate indicators
            indicators = self.calculate_indicators(candles)
            
            # Check entry conditions
            if self.check_entry_conditions(indicators):
                # Consult risk manager
                if self.risk_manager.can_open_position(self.active_positions):
                    return self.generate_entry_signal(symbol, indicators)
            
            # Check exit conditions for open positions
            if symbol in self.active_positions:
                if self.check_exit_conditions(indicators, self.active_positions[symbol]):
                    return self.generate_exit_signal(symbol)
                    
        except Exception as e:
            logger.error(f"Strategy evaluation error: {e}")
            
        return None
    
    def calculate_indicators(self, candles: pd.DataFrame) -> dict:
        """Calculate required indicators"""
        indicators = {}
        
        for condition in self.strategy['rules']['entry']['conditions']:
            indicator_name = condition['indicator']
            
            if indicator_name == 'RSI':
                period = condition.get('period', 14)
                indicators['RSI'] = self.indicator_calc.rsi(candles['close'], period)
                
            elif indicator_name == 'MACD':
                indicators['MACD'] = self.indicator_calc.macd(candles['close'])
                
            elif indicator_name == 'EMA':
                period = condition.get('period', 20)
                indicators[f'EMA_{period}'] = self.indicator_calc.ema(candles['close'], period)
                
            elif indicator_name == 'ADX':
                period = condition.get('period', 14)
                indicators['ADX'] = self.indicator_calc.adx(candles, period)
                
        return indicators
    
    def check_entry_conditions(self, indicators: dict) -> bool:
        """Check if entry conditions are met"""
        conditions = self.strategy['rules']['entry']['conditions']
        logic = self.strategy['rules']['entry']['logic']
        
        results = []
        for condition in conditions:
            result = self.evaluate_condition(condition, indicators)
            results.append(result)
            
        if logic == 'AND':
            return all(results)
        else:
            return any(results)
    
    def evaluate_condition(self, condition: dict, indicators: dict) -> bool:
        """Evaluate a single condition"""
        indicator_name = condition['indicator']
        comparison = condition['condition']
        value = condition.get('value')
        
        if indicator_name == 'RSI':
            current_value = indicators['RSI'].iloc[-1]
            
            if comparison == 'less_than':
                return current_value < value
            elif comparison == 'greater_than':
                return current_value > value
                
        elif indicator_name == 'MACD':
            macd_line = indicators['MACD']['macd'].iloc[-1]
            signal_line = indicators['MACD']['signal'].iloc[-1]
            
            if comparison == 'crosses_above':
                prev_macd = indicators['MACD']['macd'].iloc[-2]
                prev_signal = indicators['MACD']['signal'].iloc[-2]
                return prev_macd <= prev_signal and macd_line > signal_line
                
        # Add more indicator evaluations...
        
        return False
    
    def generate_entry_signal(self, symbol: str, indicators: dict) -> Signal:
        """Generate entry signal"""
        risk_settings = self.strategy['rules']['riskManagement']
        exit_rules = self.strategy['rules']['exit']
        
        # Calculate position size
        lots = self.risk_manager.calculate_position_size(
            balance=self.account_info['balance'],
            risk_percent=risk_settings.get('riskPercent', 1.0),
            stop_loss_pips=exit_rules['stopLoss']['value']
        )
        
        # Calculate SL/TP levels
        current_price = indicators['close'].iloc[-1]
        
        if exit_rules['stopLoss']['type'] == 'pips':
            sl = current_price - (exit_rules['stopLoss']['value'] * 0.0001)
        else:
            sl = current_price * (1 - exit_rules['stopLoss']['value'] / 100)
            
        if exit_rules['takeProfit']['type'] == 'pips':
            tp = current_price + (exit_rules['takeProfit']['value'] * 0.0001)
        else:
            tp = current_price * (1 + exit_rules['takeProfit']['value'] / 100)
        
        return Signal(
            action='BUY',
            symbol=symbol,
            lots=lots,
            stop_loss=sl,
            take_profit=tp,
            reason=f"Entry conditions met for {self.strategy['name']}"
        )
```

#### MT5 Connector

```python
# src/mt5/connector.py
import zmq
import json
import asyncio
from typing import Optional, Dict, Any
from src.utils.logger import logger
from src.utils.encryption import encrypt_message, decrypt_message

class MT5Connector:
    def __init__(self, host: str = "localhost", port: int = 5555):
        self.host = host
        self.port = port
        self.context = zmq.Context()
        self.socket = None
        self.connected = False
        
    def connect(self) -> bool:
        """Establish connection with MT5 EA"""
        try:
            self.socket = self.context.socket(zmq.REQ)
            self.socket.setsockopt(zmq.RCVTIMEO, 5000)  # 5 second timeout
            self.socket.setsockopt(zmq.SNDTIMEO, 5000)
            self.socket.connect(f"tcp://{self.host}:{self.port}")
            
            # Test connection
            response = self.send_command({"command": "PING"})
            if response and response.get("status") == "PONG":
                self.connected = True
                logger.info("Connected to MT5 EA")
                return True
                
        except Exception as e:
            logger.error(f"Failed to connect to MT5: {e}")
            
        return False
    
    def disconnect(self):
        """Close connection"""
        if self.socket:
            self.socket.close()
        self.context.term()
        self.connected = False
        
    def send_command(self, command: Dict[str, Any]) -> Optional[Dict]:
        """Send command to MT5 EA and wait for response"""
        if not self.connected:
            logger.error("Not connected to MT5")
            return None
            
        try:
            # Serialize and encrypt
            message = json.dumps(command)
            encrypted = encrypt_message(message)
            
            # Send
            self.socket.send_string(encrypted)
            
            # Receive response
            response = self.socket.recv_string()
            decrypted = decrypt_message(response)
            
            return json.loads(decrypted)
            
        except zmq.error.Again:
            logger.error("MT5 command timeout")
        except Exception as e:
            logger.error(f"MT5 command error: {e}")
            
        return None
    
    async def get_market_data(self, symbol: str, timeframe: str, bars: int = 100) -> Optional[Dict]:
        """Get market data from MT5"""
        command = {
            "command": "GET_MARKET_DATA",
            "symbol": symbol,
            "timeframe": timeframe,
            "bars": bars
        }
        
        return await asyncio.to_thread(self.send_command, command)
    
    async def open_position(self, signal: 'Signal') -> Optional[Dict]:
        """Open a new position"""
        command = {
            "command": "OPEN_POSITION",
            "symbol": signal.symbol,
            "type": signal.action,
            "lots": signal.lots,
            "sl": signal.stop_loss,
            "tp": signal.take_profit,
            "comment": signal.reason
        }
        
        return await asyncio.to_thread(self.send_command, command)
    
    async def close_position(self, ticket: int) -> Optional[Dict]:
        """Close an existing position"""
        command = {
            "command": "CLOSE_POSITION",
            "ticket": ticket
        }
        
        return await asyncio.to_thread(self.send_command, command)
    
    async def get_positions(self) -> Optional[Dict]:
        """Get all open positions"""
        command = {"command": "GET_POSITIONS"}
        return await asyncio.to_thread(self.send_command, command)
    
    async def get_account_info(self) -> Optional[Dict]:
        """Get account information"""
        command = {"command": "GET_ACCOUNT_INFO"}
        return await asyncio.to_thread(self.send_command, command)
```

## Expert Advisor (MQL5)

### EA Structure

```cpp
//+------------------------------------------------------------------+
//|                                         NexusTradeExecutor.mq5   |
//|                                   Copyright 2024, NexusTrade     |
//|                                        https://nexustrade.com    |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, NexusTrade"
#property link      "https://nexustrade.com"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>
#include <zmq.mqh>
#include <JAson.mqh>

//--- Input parameters
input string   ZMQ_Host = "localhost";     // ZMQ Host
input int      ZMQ_Port = 5555;           // ZMQ Port  
input int      MagicNumber = 12345;       // Magic Number
input int      Slippage = 3;              // Slippage in points

//--- Global variables
CTrade trade;
Context context;
Socket socket(context, ZMQ_REP);
CJAVal json;
bool zmq_connected = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    // Setup trade parameters
    trade.SetExpertMagicNumber(MagicNumber);
    trade.SetDeviationInPoints(Slippage);
    trade.SetTypeFilling(ORDER_FILLING_IOC);
    
    // Initialize ZMQ connection
    string address = StringFormat("tcp://%s:%d", ZMQ_Host, ZMQ_Port);
    if(socket.bind(address))
    {
        zmq_connected = true;
        Print("ZMQ server started on ", address);
    }
    else
    {
        Print("Failed to start ZMQ server");
        return(INIT_FAILED);
    }
    
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    if(zmq_connected)
    {
        socket.unbind();
        socket.disconnect();
    }
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    // Check for incoming ZMQ messages
    if(zmq_connected)
    {
        ProcessZMQMessages();
    }
}

//+------------------------------------------------------------------+
//| Process ZMQ Messages                                            |
//+------------------------------------------------------------------+
void ProcessZMQMessages()
{
    string message = "";
    
    // Non-blocking receive
    if(socket.recv(message, ZMQ_NOBLOCK))
    {
        // Decrypt message (if encryption is enabled)
        string decrypted = DecryptMessage(message);
        
        // Parse JSON
        if(!json.Deserialize(decrypted))
        {
            SendResponse(CreateErrorResponse("Invalid JSON"));
            return;
        }
        
        // Get command
        string command = json["command"].ToStr();
        
        // Process command
        string response = "";
        
        if(command == "PING")
        {
            response = CreatePingResponse();
        }
        else if(command == "GET_MARKET_DATA")
        {
            response = GetMarketData(json);
        }
        else if(command == "OPEN_POSITION")
        {
            response = OpenPosition(json);
        }
        else if(command == "CLOSE_POSITION")
        {
            response = ClosePosition(json);
        }
        else if(command == "GET_POSITIONS")
        {
            response = GetPositions();
        }
        else if(command == "GET_ACCOUNT_INFO")
        {
            response = GetAccountInfo();
        }
        else if(command == "MODIFY_POSITION")
        {
            response = ModifyPosition(json);
        }
        else
        {
            response = CreateErrorResponse("Unknown command: " + command);
        }
        
        // Send response
        SendResponse(response);
    }
}

//+------------------------------------------------------------------+
//| Get Market Data                                                 |
//+------------------------------------------------------------------+
string GetMarketData(CJAVal &params)
{
    string symbol = params["symbol"].ToStr();
    string timeframe_str = params["timeframe"].ToStr();
    int bars = (int)params["bars"].ToDbl();
    
    // Convert timeframe string to ENUM_TIMEFRAMES
    ENUM_TIMEFRAMES timeframe = StringToTimeframe(timeframe_str);
    
    // Get candle data
    MqlRates rates[];
    int copied = CopyRates(symbol, timeframe, 0, bars, rates);
    
    if(copied <= 0)
    {
        return CreateErrorResponse("Failed to get market data");
    }
    
    // Build response
    CJAVal response;
    response["status"] = "success";
    response["symbol"] = symbol;
    response["timeframe"] = timeframe_str;
    
    CJAVal candles;
    for(int i = 0; i < copied; i++)
    {
        CJAVal candle;
        candle["time"] = (long)rates[i].time;
        candle["open"] = rates[i].open;
        candle["high"] = rates[i].high;
        candle["low"] = rates[i].low;
        candle["close"] = rates[i].close;
        candle["volume"] = rates[i].tick_volume;
        
        candles.Add(candle);
    }
    
    response["candles"].Set(candles);
    
    // Add current price
    double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
    double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
    response["bid"] = bid;
    response["ask"] = ask;
    response["spread"] = (ask - bid) / SymbolInfoDouble(symbol, SYMBOL_POINT);
    
    return response.Serialize();
}

//+------------------------------------------------------------------+
//| Open Position                                                   |
//+------------------------------------------------------------------+
string OpenPosition(CJAVal &params)
{
    string symbol = params["symbol"].ToStr();
    string type_str = params["type"].ToStr();
    double lots = params["lots"].ToDbl();
    double sl = params["sl"].ToDbl();
    double tp = params["tp"].ToDbl();
    string comment = params["comment"].ToStr();
    
    // Validate lots
    double min_lot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
    double max_lot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
    double lot_step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
    
    lots = MathMax(min_lot, MathMin(max_lot, NormalizeDouble(lots, 2)));
    
    // Get current prices
    double price;
    ENUM_ORDER_TYPE order_type;
    
    if(type_str == "BUY")
    {
        order_type = ORDER_TYPE_BUY;
        price = SymbolInfoDouble(symbol, SYMBOL_ASK);
    }
    else if(type_str == "SELL")
    {
        order_type = ORDER_TYPE_SELL;
        price = SymbolInfoDouble(symbol, SYMBOL_BID);
    }
    else
    {
        return CreateErrorResponse("Invalid order type");
    }
    
    // Open position
    bool result = trade.PositionOpen(
        symbol,
        order_type,
        lots,
        price,
        sl,
        tp,
        comment
    );
    
    if(result)
    {
        CJAVal response;
        response["status"] = "success";
        response["ticket"] = trade.ResultOrder();
        response["price"] = trade.ResultPrice();
        response["lots"] = lots;
        
        return response.Serialize();
    }
    else
    {
        return CreateErrorResponse("Failed to open position: " + GetLastErrorString());
    }
}

//+------------------------------------------------------------------+
//| Close Position                                                  |
//+------------------------------------------------------------------+
string ClosePosition(CJAVal &params)
{
    ulong ticket = (ulong)params["ticket"].ToDbl();
    
    if(trade.PositionClose(ticket))
    {
        CJAVal response;
        response["status"] = "success";
        response["ticket"] = (long)ticket;
        response["close_price"] = trade.ResultPrice();
        
        return response.Serialize();
    }
    else
    {
        return CreateErrorResponse("Failed to close position: " + GetLastErrorString());
    }
}

//+------------------------------------------------------------------+
//| Get Open Positions                                              |
//+------------------------------------------------------------------+
string GetPositions()
{
    CJAVal response;
    response["status"] = "success";
    
    CJAVal positions;
    int total = PositionsTotal();
    
    for(int i = 0; i < total; i++)
    {
        if(PositionSelectByIndex(i))
        {
            // Check magic number
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber)
                continue;
                
            CJAVal position;
            position["ticket"] = PositionGetInteger(POSITION_TICKET);
            position["symbol"] = PositionGetString(POSITION_SYMBOL);
            position["type"] = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL";
            position["lots"] = PositionGetDouble(POSITION_VOLUME);
            position["open_price"] = PositionGetDouble(POSITION_PRICE_OPEN);
            position["current_price"] = PositionGetDouble(POSITION_PRICE_CURRENT);
            position["sl"] = PositionGetDouble(POSITION_SL);
            position["tp"] = PositionGetDouble(POSITION_TP);
            position["profit"] = PositionGetDouble(POSITION_PROFIT);
            position["swap"] = PositionGetDouble(POSITION_SWAP);
            position["commission"] = PositionGetDouble(POSITION_COMMISSION);
            position["open_time"] = (long)PositionGetInteger(POSITION_TIME);
            position["comment"] = PositionGetString(POSITION_COMMENT);
            
            positions.Add(position);
        }
    }
    
    response["positions"].Set(positions);
    response["total"] = positions.Size();
    
    return response.Serialize();
}

//+------------------------------------------------------------------+
//| Get Account Information                                         |
//+------------------------------------------------------------------+
string GetAccountInfo()
{
    CJAVal response;
    response["status"] = "success";
    
    response["balance"] = AccountInfoDouble(ACCOUNT_BALANCE);
    response["equity"] = AccountInfoDouble(ACCOUNT_EQUITY);
    response["margin"] = AccountInfoDouble(ACCOUNT_MARGIN);
    response["free_margin"] = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
    response["margin_level"] = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
    response["profit"] = AccountInfoDouble(ACCOUNT_PROFIT);
    response["credit"] = AccountInfoDouble(ACCOUNT_CREDIT);
    response["leverage"] = AccountInfoInteger(ACCOUNT_LEVERAGE);
    response["currency"] = AccountInfoString(ACCOUNT_CURRENCY);
    response["server"] = AccountInfoString(ACCOUNT_SERVER);
    response["company"] = AccountInfoString(ACCOUNT_COMPANY);
    response["name"] = AccountInfoString(ACCOUNT_NAME);
    response["number"] = AccountInfoInteger(ACCOUNT_LOGIN);
    
    return response.Serialize();
}

//+------------------------------------------------------------------+
//| Helper Functions                                                |
//+------------------------------------------------------------------+
string CreateErrorResponse(string error_message)
{
    CJAVal response;
    response["status"] = "error";
    response["error"] = error_message;
    return response.Serialize();
}

string CreatePingResponse()
{
    CJAVal response;
    response["status"] = "PONG";
    response["time"] = (long)TimeCurrent();
    return response.Serialize();
}

void SendResponse(string response)
{
    // Encrypt response (if encryption is enabled)
    string encrypted = EncryptMessage(response);
    socket.send(encrypted);
}

ENUM_TIMEFRAMES StringToTimeframe(string tf)
{
    if(tf == "M1") return PERIOD_M1;
    if(tf == "M5") return PERIOD_M5;
    if(tf == "M15") return PERIOD_M15;
    if(tf == "M30") return PERIOD_M30;
    if(tf == "H1") return PERIOD_H1;
    if(tf == "H4") return PERIOD_H4;
    if(tf == "D1") return PERIOD_D1;
    if(tf == "W1") return PERIOD_W1;
    if(tf == "MN") return PERIOD_MN1;
    
    return PERIOD_H1; // Default
}

string GetLastErrorString()
{
    int error = GetLastError();
    return StringFormat("Error %d: %s", error, ErrorDescription(error));
}
```

## Installation & Setup

### Windows Application Setup

#### Requirements
```
Windows 10/11 (64-bit)
Python 3.9+
MetaTrader 5
Visual C++ Redistributable 2019+
.NET Framework 4.8+
```

#### Installation Steps

1. **Download and Install Python**
```bash
# Download from python.org
# Add Python to PATH during installation
```

2. **Install Dependencies**
```bash
pip install -r requirements.txt
```

3. **Configure Application**
```yaml
# config/settings.yaml
api:
  base_url: https://api.nexustrade.com
  timeout: 30
  retry_attempts: 3

mt5:
  host: localhost
  port: 5555
  heartbeat_interval: 30

trading:
  max_positions: 5
  max_daily_loss: 1000
  risk_per_trade: 1.0  # Percentage

ui:
  theme: dark
  language: en
  update_interval: 1000  # ms
```

4. **Build Executable**
```bash
# Using PyInstaller
pyinstaller build.spec

# Output will be in dist/NexusTradeExecutor.exe
```

### Expert Advisor Setup

1. **Copy EA to MT5**
```
Copy NexusTradeExecutor.ex5 to:
C:\Users\[Username]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Experts\
```

2. **Install ZMQ Library**
```
Copy zmq.mqh and libzmq.dll to:
C:\Users\[Username]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Include\
C:\Users\[Username]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Libraries\
```

3. **Attach EA to Chart**
- Open MT5
- Open any chart
- Drag EA to chart
- Enable "Allow DLL imports"
- Configure parameters

## Security Implementation

### API Key Management

```python
# src/api/auth.py
import os
import hashlib
import hmac
from cryptography.fernet import Fernet
from src.config.settings import Settings

class APIKeyManager:
    def __init__(self):
        self.settings = Settings()
        self.cipher_suite = None
        self._init_encryption()
    
    def _init_encryption(self):
        """Initialize encryption for storing API keys"""
        # Get or generate encryption key
        key_file = os.path.join(self.settings.data_dir, '.key')
        
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                key = f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, 'wb') as f:
                f.write(key)
            # Set file permissions (Windows)
            os.chmod(key_file, 0o600)
        
        self.cipher_suite = Fernet(key)
    
    def store_credentials(self, api_key: str, api_secret: str):
        """Securely store API credentials"""
        encrypted_key = self.cipher_suite.encrypt(api_key.encode())
        encrypted_secret = self.cipher_suite.encrypt(api_secret.encode())
        
        # Store in secure location
        credentials = {
            'api_key': encrypted_key.decode(),
            'api_secret': encrypted_secret.decode()
        }
        
        cred_file = os.path.join(self.settings.data_dir, '.credentials')
        with open(cred_file, 'w') as f:
            json.dump(credentials, f)
        
        os.chmod(cred_file, 0o600)
    
    def get_credentials(self):
        """Retrieve and decrypt API credentials"""
        cred_file = os.path.join(self.settings.data_dir, '.credentials')
        
        if not os.path.exists(cred_file):
            return None, None
        
        with open(cred_file, 'r') as f:
            credentials = json.load(f)
        
        api_key = self.cipher_suite.decrypt(credentials['api_key'].encode()).decode()
        api_secret = self.cipher_suite.decrypt(credentials['api_secret'].encode()).decode()
        
        return api_key, api_secret
    
    def sign_request(self, payload: str, api_secret: str) -> str:
        """Sign API request with HMAC"""
        signature = hmac.new(
            api_secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
```

### Local Data Encryption

```python
# src/utils/encryption.py
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os
import base64

class DataEncryption:
    def __init__(self):
        self.key = self._get_or_generate_key()
    
    def _get_or_generate_key(self):
        """Get or generate encryption key"""
        key_file = os.path.expanduser('~/.nexustrade/.local_key')
        
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            key = os.urandom(32)  # 256-bit key
            os.makedirs(os.path.dirname(key_file), exist_ok=True)
            with open(key_file, 'wb') as f:
                f.write(key)
            return key
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext"""
        iv = os.urandom(16)
        cipher = Cipher(
            algorithms.AES(self.key),
            modes.CBC(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Pad plaintext
        padding_length = 16 - (len(plaintext) % 16)
        padded = plaintext + (chr(padding_length) * padding_length)
        
        encrypted = encryptor.update(padded.encode()) + encryptor.finalize()
        
        return base64.b64encode(iv + encrypted).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext"""
        data = base64.b64decode(ciphertext)
        iv = data[:16]
        encrypted = data[16:]
        
        cipher = Cipher(
            algorithms.AES(self.key),
            modes.CBC(iv),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        decrypted = decryptor.update(encrypted) + decryptor.finalize()
        
        # Remove padding
        padding_length = decrypted[-1]
        return decrypted[:-padding_length].decode()
```

## Performance Optimization

### Strategy Caching

```python
# src/core/cache.py
from functools import lru_cache
import pickle
import hashlib

class StrategyCache:
    def __init__(self, max_size: int = 100):
        self.max_size = max_size
        self._cache = {}
    
    def _get_cache_key(self, market_data: dict, strategy: dict) -> str:
        """Generate cache key from market data and strategy"""
        data_str = json.dumps(market_data, sort_keys=True)
        strategy_str = json.dumps(strategy, sort_keys=True)
        combined = f"{data_str}:{strategy_str}"
        
        return hashlib.md5(combined.encode()).hexdigest()
    
    @lru_cache(maxsize=1000)
    def calculate_indicators(self, symbol: str, timeframe: str, candles_hash: str):
        """Cached indicator calculation"""
        # This will be called only when cache miss
        return self._calculate_indicators_impl(symbol, timeframe, candles_hash)
    
    def get_signal(self, market_data: dict, strategy: dict) -> Optional[Signal]:
        """Get cached signal or calculate new one"""
        cache_key = self._get_cache_key(market_data, strategy)
        
        if cache_key in self._cache:
            cached_time, signal = self._cache[cache_key]
            # Check if cache is still valid (5 seconds)
            if time.time() - cached_time < 5:
                return signal
        
        # Calculate new signal
        signal = self._calculate_signal(market_data, strategy)
        
        # Update cache
        self._cache[cache_key] = (time.time(), signal)
        
        # Maintain cache size
        if len(self._cache) > self.max_size:
            # Remove oldest entries
            sorted_items = sorted(self._cache.items(), key=lambda x: x[1][0])
            for key, _ in sorted_items[:len(self._cache) - self.max_size]:
                del self._cache[key]
        
        return signal
```

### Multi-threading

```python
# src/core/executor.py
import concurrent.futures
from queue import Queue, Empty
import threading

class MultiThreadedExecutor:
    def __init__(self, num_workers: int = 4):
        self.num_workers = num_workers
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=num_workers)
        self.task_queue = Queue()
        self.result_queue = Queue()
        self.running = False
    
    def start(self):
        """Start worker threads"""
        self.running = True
        
        for _ in range(self.num_workers):
            self.executor.submit(self._worker)
    
    def _worker(self):
        """Worker thread function"""
        while self.running:
            try:
                task = self.task_queue.get(timeout=1)
                
                if task is None:
                    break
                
                # Process task
                result = self._process_task(task)
                
                # Put result
                self.result_queue.put(result)
                
            except Empty:
                continue
            except Exception as e:
                logger.error(f"Worker error: {e}")
    
    def _process_task(self, task):
        """Process individual task"""
        task_type = task['type']
        
        if task_type == 'EVALUATE_STRATEGY':
            return self.evaluate_strategy(task['data'])
        elif task_type == 'CALCULATE_INDICATORS':
            return self.calculate_indicators(task['data'])
        elif task_type == 'CHECK_RISK':
            return self.check_risk_limits(task['data'])
        
        return None
    
    def submit_task(self, task):
        """Submit task for processing"""
        self.task_queue.put(task)
    
    def get_results(self):
        """Get processed results"""
        results = []
        
        while not self.result_queue.empty():
            try:
                result = self.result_queue.get_nowait()
                results.append(result)
            except Empty:
                break
        
        return results
    
    def stop(self):
        """Stop worker threads"""
        self.running = False
        
        # Send stop signal to workers
        for _ in range(self.num_workers):
            self.task_queue.put(None)
        
        self.executor.shutdown(wait=True)
```

## Testing

### Unit Tests

```python
# tests/unit/test_strategy_engine.py
import pytest
from src.core.strategy_engine import StrategyEngine, Signal

class TestStrategyEngine:
    def test_evaluate_condition(self):
        strategy = {
            'rules': {
                'entry': {
                    'conditions': [
                        {
                            'indicator': 'RSI',
                            'condition': 'less_than',
                            'value': 30,
                            'period': 14
                        }
                    ],
                    'logic': 'AND'
                }
            }
        }
        
        engine = StrategyEngine(strategy)
        
        indicators = {'RSI': pd.Series([25, 28, 29])}
        
        condition = strategy['rules']['entry']['conditions'][0]
        result = engine.evaluate_condition(condition, indicators)
        
        assert result == True
    
    def test_check_entry_conditions_and_logic(self):
        strategy = {
            'rules': {
                'entry': {
                    'conditions': [
                        {'indicator': 'RSI', 'condition': 'less_than', 'value': 30},
                        {'indicator': 'ADX', 'condition': 'greater_than', 'value': 25}
                    ],
                    'logic': 'AND'
                }
            }
        }
        
        engine = StrategyEngine(strategy)
        
        # Both conditions true
        indicators = {
            'RSI': pd.Series([25]),
            'ADX': pd.Series([30])
        }
        
        assert engine.check_entry_conditions(indicators) == True
        
        # One condition false
        indicators['ADX'] = pd.Series([20])
        assert engine.check_entry_conditions(indicators) == False
```

## Troubleshooting

### Common Issues

1. **ZMQ Connection Failed**
   - Check Windows Firewall settings
   - Ensure MT5 EA is running
   - Verify port 5555 is not in use

2. **DLL Import Error in MT5**
   - Enable "Allow DLL imports" in EA settings
   - Install Visual C++ Redistributable
   - Check libzmq.dll is in correct location

3. **API Authentication Failed**
   - Verify API key and secret
   - Check system time synchronization
   - Ensure subscription is active

4. **High CPU Usage**
   - Reduce update frequency
   - Optimize indicator calculations
   - Enable caching

5. **Memory Leak**
   - Update to latest version
   - Clear old log files
   - Restart application periodically
