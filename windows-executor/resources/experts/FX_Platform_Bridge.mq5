//+------------------------------------------------------------------+
//|                                               ZeroMQBridge.mq5  |
//|                        Copyright 2024, FX Platform Team          |
//|                                             https://fx.nusanexus.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, FX Platform Team"
#property link      "https://fx.nusanexus.com"
#property version   "1.00"
#property description "ZeroMQ Bridge for FX Platform - Automated Trading Executor"

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\AccountInfo.mqh>
#include <Trade\SymbolInfo.mqh>

// ZeroMQ imports - Use proper function pointers without namespace
#import "libzmq.dll"
void* zmq_ctx_new(void);
void* zmq_socket(void*, int);
int zmq_connect(void*, uchar&[]);
int zmq_bind(void*, uchar&[]);
int zmq_send(void*, uchar&[], int, int);
int zmq_recv(void*, uchar&[], int, int);
int zmq_close(void*);
int zmq_ctx_term(void*);
int zmq_setsockopt(void*, int, const int&, int);
void zmq_version(int&, int&, int&);
#import

// ZeroMQ constants
#define ZMQ_REP 4
#define ZMQ_REQ 3
#define ZMQ_POLLIN 1
#define ZMQ_SNDTIMEO 1000
#define ZMQ_RCVTIMEO 1000

// Input parameters
input group "Connection Settings"
input string InpServerAddress = "tcp://localhost:5555";  // ZeroMQ server address
input int    InpTimeoutMs = 5000;                        // Connection timeout (ms)
input int    InpHeartbeatInterval = 30000;               // Heartbeat interval (ms)

input group "Trading Settings"
input double InpDefaultLots = 0.01;                      // Default lot size
input int    InpSlippage = 3;                            // Max slippage points
input int    InpMagicNumber = 12345;                     // Magic number for orders

input group "Safety Settings"
input double InpMaxDrawdownPercent = 10.0;               // Max drawdown %
input int    InpMaxOrdersPerSymbol = 5;                  // Max orders per symbol
input bool   InpEnablePositionSizing = true;             // Enable position sizing

// Global variables
CTrade trade;
CPositionInfo position;
CAccountInfo account;
CSymbolInfo symbol;
int g_context = 0;
int g_socket = 0;
datetime g_lastHeartbeat = 0;
bool g isConnected = false;
string g_configFile = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    Print("[ZeroMQ Bridge] Initializing...");

    // Initialize trading objects
    trade.SetExpertMagicNumber(InpMagicNumber);
    trade.SetSlippage(InpSlippage);
    trade.SetTypeFilling(ORDER_FILLING_IOC);

    // Load configuration
    if (!LoadConfiguration()) {
        Print("[ZeroMQ Bridge] Failed to load configuration");
        return INIT_FAILED;
    }

    // Initialize ZeroMQ
    if (!InitializeZeroMQ()) {
        Print("[ZeroMQ Bridge] Failed to initialize ZeroMQ");
        return INIT_FAILED;
    }

    // Connect to server
    if (!ConnectToServer()) {
        Print("[ZeroMQ Bridge] Failed to connect to server");
        return INIT_FAILED;
    }

    Print("[ZeroMQ Bridge] Successfully connected to server: ", InpServerAddress);
    g_lastHeartbeat = TimeCurrent();
    g isConnected = true;

    // Send initial status
    SendStatusMessage("connected");

    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    Print("[ZeroMQ Bridge] Deinitializing...");

    // Send disconnect status
    if (g isConnected) {
        SendStatusMessage("disconnected");
    }

    // Cleanup ZeroMQ
    CleanupZeroMQ();

    Print("[ZeroMQ Bridge] Cleanup completed");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
    // Check connection
    if (!g isConnected) {
        if (!ConnectToServer()) {
            return;
        }
    }

    // Send heartbeat periodically
    if (TimeCurrent() - g_lastHeartbeat > InpHeartbeatInterval / 1000) {
        SendHeartbeat();
        g_lastHeartbeat = TimeCurrent();
    }

    // Process incoming commands
    ProcessCommands();

    // Send position updates if needed
    CheckPositionUpdates();
}

//+------------------------------------------------------------------+
//| Initialize ZeroMQ context and socket                            |
//+------------------------------------------------------------------+
bool InitializeZeroMQ() {
    // Create context
    g_context = zmq_ctx_new();
    if (g_context == 0) {
        Print("[ZeroMQ Bridge] Failed to create context");
        return false;
    }

    // Create socket (REQ pattern)
    g_socket = zmq_socket(g_context, ZMQ_REQ);
    if (g_socket == 0) {
        Print("[ZeroMQ Bridge] Failed to create socket");
        zmq_term(g_context);
        return false;
    }

    // Set timeout options
    int timeout = InpTimeoutMs;
    zmq_setsockopt(g_socket, ZMQ_SNDTIMEO, timeout, sizeof(timeout));
    zmq_setsockopt(g_socket, ZMQ_RCVTIMEO, timeout, sizeof(timeout));

    return true;
}

//+------------------------------------------------------------------+
//| Connect to ZeroMQ server                                         |
//+------------------------------------------------------------------+
bool ConnectToServer() {
    if (g_socket == 0) {
        return false;
    }

    int result = zmq_connect(g_socket, InpServerAddress);
    if (result != 0) {
        Print("[ZeroMQ Bridge] Failed to connect to ", InpServerAddress);
        return false;
    }

    g isConnected = true;
    return true;
}

//+------------------------------------------------------------------+
//| Cleanup ZeroMQ resources                                         |
//+------------------------------------------------------------------+
void CleanupZeroMQ() {
    if (g_socket != 0) {
        zmq_close(g_socket);
        g_socket = 0;
    }

    if (g_context != 0) {
        zmq_term(g_context);
        g_context = 0;
    }

    g isConnected = false;
}

//+------------------------------------------------------------------+
//| Process incoming commands                                        |
//+------------------------------------------------------------------+
void ProcessCommands() {
    string response = "";

    // Check for incoming message (non-blocking)
    int result = zmq_recv(g_socket, response, ZMQ_RCVTIMEO);

    if (result > 0 && StringLen(response) > 0) {
        Print("[ZeroMQ Bridge] Received command: ", response);

        // Process command
        string commandResponse = ProcessCommand(response);

        // Send response
        if (StringLen(commandResponse) > 0) {
            zmq_send(g_socket, commandResponse, 0);
        }
    }
}

//+------------------------------------------------------------------+
//| Process individual command                                       |
//+------------------------------------------------------------------+
string ProcessCommand(string command) {
    // Parse JSON command (simplified parsing)
    string cmdType = ExtractJsonValue(command, "type");

    if (cmdType == "ping") {
        return CreateResponse("pong", "success", "Server is alive");
    }

    if (cmdType == "get_account_info") {
        return GetAccountInfo();
    }

    if (cmdType == "get_positions") {
        return GetPositions();
    }

    if (cmdType == "open_trade") {
        return ProcessOpenTrade(command);
    }

    if (cmdType == "close_trade") {
        return ProcessCloseTrade(command);
    }

    if (cmdType == "modify_trade") {
        return ProcessModifyTrade(command);
    }

    if (cmdType == "get_market_data") {
        return GetMarketData(command);
    }

    if (cmdType == "get_symbols") {
        return GetSymbols();
    }

    return CreateResponse("", "error", "Unknown command: " + cmdType);
}

//+------------------------------------------------------------------+
//| Process open trade command                                       |
//+------------------------------------------------------------------+
string ProcessOpenTrade(string command) {
    string symbol = ExtractJsonValue(command, "symbol");
    double lots = StringToDouble(ExtractJsonValue(command, "lots"));
    double stopLoss = StringToDouble(ExtractJsonValue(command, "stopLoss"));
    double takeProfit = StringToDouble(ExtractJsonValue(command, "takeProfit"));
    string orderType = ExtractJsonValue(command, "orderType"); // "buy" or "sell"

    // Validate inputs
    if (StringLen(symbol) == 0) {
        return CreateResponse("", "error", "Symbol is required");
    }

    if (lots <= 0) {
        lots = InpDefaultLots;
    }

    // Check position limits
    if (!CheckPositionLimits(symbol)) {
        return CreateResponse("", "error", "Position limit exceeded for " + symbol);
    }

    // Check account safety
    if (!CheckAccountSafety()) {
        return CreateResponse("", "error", "Account safety check failed");
    }

    // Set symbol info
    if (!symbol.Name(symbol)) {
        return CreateResponse("", "error", "Invalid symbol: " + symbol);
    }

    // Calculate prices
    double ask = symbol.Ask();
    double bid = symbol.Bid();
    double point = symbol.Point();

    if (stopLoss > 0) {
        stopLoss = NormalizeDouble(stopLoss, symbol.Digits());
    }
    if (takeProfit > 0) {
        takeProfit = NormalizeDouble(takeProfit, symbol.Digits());
    }

    // Execute trade
    bool result = false;
    string errorInfo = "";

    if (orderType == "sell") {
        result = trade.Sell(lots, symbol, bid, stopLoss, takeProfit, "ZeroMQ Bridge");
    } else {
        result = trade.Buy(lots, symbol, ask, stopLoss, takeProfit, "ZeroMQ Bridge");
    }

    if (result) {
        string response = "{";
        response += "\"type\":\"open_trade_result\",";
        response += "\"status\":\"success\",";
        response += "\"ticket\":" + IntegerToString(trade.ResultOrder()) + ",";
        response += "\"price\":" + DoubleToString(trade.ResultPrice(), symbol.Digits()) + ",";
        response += "\"volume\":" + DoubleToString(trade.ResultVolume(), 2) + ",";
        response += "\"symbol\":\"" + symbol + "\"";
        response += "}";
        return response;
    } else {
        return CreateResponse("", "error", "Trade failed: " + trade.ResultComment());
    }
}

//+------------------------------------------------------------------+
//| Process close trade command                                      |
//+------------------------------------------------------------------+
string ProcessCloseTrade(string command) {
    ulong ticket = StringToInteger(ExtractJsonValue(command, "ticket"));

    if (ticket == 0) {
        return CreateResponse("", "error", "Ticket is required");
    }

    if (position.SelectByTicket(ticket)) {
        if (trade.PositionClose(ticket)) {
            string response = "{";
            response += "\"type\":\"close_trade_result\",";
            response += "\"status\":\"success\",";
            response += "\"ticket\":" + IntegerToString(ticket) + ",";
            response += "\"profit\":" + DoubleToString(position.Profit(), 2) + ",";
            response += "\"closedPrice\":" + DoubleToString(trade.ResultPrice(), position.Symbol().Digits());
            response += "}";
            return response;
        } else {
            return CreateResponse("", "error", "Failed to close position: " + trade.ResultComment());
        }
    } else {
        return CreateResponse("", "error", "Position not found: " + IntegerToString(ticket));
    }
}

//+------------------------------------------------------------------+
//| Process modify trade command                                     |
//+------------------------------------------------------------------+
string ProcessModifyTrade(string command) {
    ulong ticket = StringToInteger(ExtractJsonValue(command, "ticket"));
    double stopLoss = StringToDouble(ExtractJsonValue(command, "stopLoss"));
    double takeProfit = StringToDouble(ExtractJsonValue(command, "takeProfit"));

    if (ticket == 0) {
        return CreateResponse("", "error", "Ticket is required");
    }

    if (position.SelectByTicket(ticket)) {
        // Normalize values
        symbol.Name(position.Symbol());
        if (stopLoss > 0) {
            stopLoss = NormalizeDouble(stopLoss, symbol.Digits());
        }
        if (takeProfit > 0) {
            takeProfit = NormalizeDouble(takeProfit, symbol.Digits());
        }

        if (trade.PositionModify(ticket, stopLoss, takeProfit)) {
            string response = "{";
            response += "\"type\":\"modify_trade_result\",";
            response += "\"status\":\"success\",";
            response += "\"ticket\":" + IntegerToString(ticket) + ",";
            response += "\"stopLoss\":" + DoubleToString(stopLoss, symbol.Digits()) + ",";
            response += "\"takeProfit\":" + DoubleToString(takeProfit, symbol.Digits());
            response += "}";
            return response;
        } else {
            return CreateResponse("", "error", "Failed to modify position: " + trade.ResultComment());
        }
    } else {
        return CreateResponse("", "error", "Position not found: " + IntegerToString(ticket));
    }
}

//+------------------------------------------------------------------+
//| Get account information                                           |
//+------------------------------------------------------------------+
string GetAccountInfo() {
    string response = "{";
    response += "\"type\":\"account_info\",";
    response += "\"status\":\"success\",";
    response += "\"balance\":" + DoubleToString(account.Balance(), 2) + ",";
    response += "\"equity\":" + DoubleToString(account.Equity(), 2) + ",";
    response += "\"margin\":" + DoubleToString(account.Margin(), 2) + ",";
    response += "\"freeMargin\":" + DoubleToString(account.FreeMargin(), 2) + ",";
    response += "\"marginLevel\":" + DoubleToString(account.MarginLevel(), 2) + ",";
    response += "\"profit\":" + DoubleToString(account.Profit(), 2) + ",";
    response += "\"leverage\":" + IntegerToString(account.Leverage()) + ",";
    response += "\"currency\":\"" + account.Currency() + "\",";
    response += "\"company\":\"" + account.Company() + "\",";
    response += "\"name\":\"" + account.Name() + "\"";
    response += "}";
    return response;
}

//+------------------------------------------------------------------+
//| Get open positions                                               |
//+------------------------------------------------------------------+
string GetPositions() {
    string response = "{";
    response += "\"type\":\"positions\",";
    response += "\"status\":\"success\",";
    response += "\"positions\":[";

    bool first = true;
    for (int i = 0; i < PositionsTotal(); i++) {
        if (position.SelectByIndex(i)) {
            if (!first) response += ",";
            first = false;

            response += "{";
            response += "\"ticket\":" + IntegerToString(position.Ticket()) + ",";
            response += "\"symbol\":\"" + position.Symbol() + "\",";
            response += "\"type\":\"" + (position.PositionType() == POSITION_TYPE_BUY ? "buy" : "sell") + "\",";
            response += "\"volume\":" + DoubleToString(position.Volume(), 2) + ",";
            response += "\"priceOpen\":" + DoubleToString(position.PriceOpen(), position.Symbol().Digits()) + ",";
            response += "\"priceCurrent\":" + DoubleToString(position.PriceCurrent(), position.Symbol().Digits()) + ",";
            response += "\"profit\":" + DoubleToString(position.Profit(), 2) + ",";
            response += "\"stopLoss\":" + DoubleToString(position.StopLoss(), position.Symbol().Digits()) + ",";
            response += "\"takeProfit\":" + DoubleToString(position.TakeProfit(), position.Symbol().Digits()) + ",";
            response += "\"swap\":" + DoubleToString(position.Swap(), 2) + ",";
            response += "\"commission\":" + DoubleToString(position.Commission(), 2) + ",";
            response += "\"time\":" + IntegerToString(position.Time()) + "";
            response += "}";
        }
    }

    response += "]}";
    return response;
}

//+------------------------------------------------------------------+
//| Get market data                                                  |
//+------------------------------------------------------------------+
string GetMarketData(string command) {
    string symbolName = ExtractJsonValue(command, "symbol");

    if (StringLen(symbolName) == 0) {
        return CreateResponse("", "error", "Symbol is required");
    }

    if (!symbol.Name(symbolName)) {
        return CreateResponse("", "error", "Invalid symbol: " + symbolName);
    }

    string response = "{";
    response += "\"type\":\"market_data\",";
    response += "\"status\":\"success\",";
    response += "\"symbol\":\"" + symbolName + "\",";
    response += "\"bid\":" + DoubleToString(symbol.Bid(), symbol.Digits()) + ",";
    response += "\"ask\":" + DoubleToString(symbol.Ask(), symbol.Digits()) + ",";
    response += "\"spread\":" + IntegerToString(symbol.Spread()) + ",";
    response += "\"point\":" + DoubleToString(symbol.Point(), symbol.Digits()) + ",";
    response += "\"digits\":" + IntegerToString(symbol.Digits()) + ",";
    response += "\"volume\":" + IntegerToString(symbol.VolumeLong()) + ",";
    response += "\"time\":" + IntegerToString(symbol.Time()) + "";
    response += "}";
    return response;
}

//+------------------------------------------------------------------+
//| Get available symbols                                            |
//+------------------------------------------------------------------+
string GetSymbols() {
    string response = "{";
    response += "\"type\":\"symbols\",";
    response += "\"status\":\"success\",";
    response += "\"symbols\":[";

    bool first = true;
    for (int i = 0; i < SymbolsTotal(false); i++) {
        string symbolName = SymbolName(i, false);
        if (symbol.Select(symbolName)) {
            if (!first) response += ",";
            first = false;

            response += "{";
            response += "\"symbol\":\"" + symbolName + "\",";
            response += "\"bid\":" + DoubleToString(symbol.Bid(), symbol.Digits()) + ",";
            response += "\"ask\":" + DoubleToString(symbol.Ask(), symbol.Digits()) + ",";
            response += "\"digits\":" + IntegerToString(symbol.Digits()) + ",";
            response += "\"tradeMode\":" + IntegerToString(symbol.TradeMode()) + "";
            response += "}";
        }
    }

    response += "]}";
    return response;
}

//+------------------------------------------------------------------+
//| Send heartbeat message                                          |
//+------------------------------------------------------------------+
void SendHeartbeat() {
    string message = "{";
    message += "\"type\":\"heartbeat\",";
    message += "\"status\":\"alive\",";
    message += "\"time\":" + IntegerToString(TimeCurrent()) + ",";
    message += "\"account\":\"" + IntegerToString(account.Login()) + "\",";
    message += "\"broker\":\"" + account.Company() + "\"";
    message += "}";

    zmq_send(g_socket, message, 0);
}

//+------------------------------------------------------------------+
//| Send status message                                              |
//+------------------------------------------------------------------+
void SendStatusMessage(string status) {
    string message = "{";
    message += "\"type\":\"status\",";
    message += "\"status\":\"" + status + "\",";
    message += "\"time\":" + IntegerToString(TimeCurrent()) + ",";
    message += "\"account\":\"" + IntegerToString(account.Login()) + "\",";
    message += "\"broker\":\"" + account.Company() + "\"";
    message += "}";

    zmq_send(g_socket, message, 0);
}

//+------------------------------------------------------------------+
//| Check position limits                                            |
//+------------------------------------------------------------------+
bool CheckPositionLimits(string symbolName) {
    int count = 0;
    for (int i = 0; i < PositionsTotal(); i++) {
        if (position.SelectByIndex(i)) {
            if (position.Symbol() == symbolName) {
                count++;
            }
        }
    }

    return count < InpMaxOrdersPerSymbol;
}

//+------------------------------------------------------------------+
//| Check account safety                                             |
//+------------------------------------------------------------------+
bool CheckAccountSafety() {
    double equity = account.Equity();
    double balance = account.Balance();

    if (balance <= 0) return true;

    double drawdownPercent = (balance - equity) / balance * 100.0;

    return drawdownPercent < InpMaxDrawdownPercent;
}

//+------------------------------------------------------------------+
//| Check position updates                                           |
//+------------------------------------------------------------------+
void CheckPositionUpdates() {
    // This could be enhanced to track position changes
    // and send updates when positions are modified
}

//+------------------------------------------------------------------+
//| Load configuration from file                                     |
//+------------------------------------------------------------------+
bool LoadConfiguration() {
    string terminalPath = TerminalInfoString(TERMINAL_PATH);
    string dataPath = TerminalInfoString(TERMINAL_DATA_PATH);

    g_configFile = dataPath + "\\MQL5\\Files\\ZeroMQBridge.json";

    // Check if config file exists
    if (FileIsExist(g_configFile)) {
        int handle = FileOpen(g_configFile, FILE_READ | FILE_TXT);
        if (handle != INVALID_HANDLE) {
            string config = FileReadString(handle);
            FileClose(handle);

            // Parse config (simplified)
            string serverAddr = ExtractJsonValue(config, "serverAddress");
            if (StringLen(serverAddr) > 0) {
                InpServerAddress = serverAddr;
            }

            int timeout = StringToInteger(ExtractJsonValue(config, "timeout"));
            if (timeout > 0) {
                InpTimeoutMs = timeout;
            }

            Print("[ZeroMQ Bridge] Configuration loaded from file");
            return true;
        }
    } else {
        // Create default config file
        CreateDefaultConfig();
    }

    return true;
}

//+------------------------------------------------------------------+
//| Create default configuration file                                 |
//+------------------------------------------------------------------+
void CreateDefaultConfig() {
    string config = "{";
    config += "\"serverAddress\":\"" + InpServerAddress + "\",";
    config += "\"timeout\":" + IntegerToString(InpTimeoutMs) + ",";
    config += "\"heartbeatInterval\":" + IntegerToString(InpHeartbeatInterval) + ",";
    config += "\"defaultLots\":" + DoubleToString(InpDefaultLots, 2) + ",";
    config += "\"magicNumber\":" + IntegerToString(InpMagicNumber) + "";
    config += "}";

    int handle = FileOpen(g_configFile, FILE_WRITE | FILE_TXT);
    if (handle != INVALID_HANDLE) {
        FileWriteString(handle, config);
        FileClose(handle);
        Print("[ZeroMQ Bridge] Default configuration created");
    }
}

//+------------------------------------------------------------------+
//| Create JSON response                                             |
//+------------------------------------------------------------------+
string CreateResponse(string type, string status, string message) {
    string response = "{";
    response += "\"type\":\"" + type + "\",";
    response += "\"status\":\"" + status + "\",";
    response += "\"message\":\"" + message + "\",";
    response += "\"time\":" + IntegerToString(TimeCurrent());
    response += "}";
    return response;
}

//+------------------------------------------------------------------+
//| Extract JSON value (simplified)                                  |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key) {
    // Very simple JSON parsing - in production, use proper JSON parser
    string pattern = "\"" + key + "\":\"";
    int start = StringFind(json, pattern);
    if (start >= 0) {
        start += StringLen(pattern);
        int end = StringFind(json, "\"", start);
        if (end > start) {
            return StringSubstr(json, start, end - start);
        }
    }

    // Try numeric values
    pattern = "\"" + key + "\":";
    start = StringFind(json, pattern);
    if (start >= 0) {
        start += StringLen(pattern);
        int end = StringFind(json, ",", start);
        if (end < 0) end = StringFind(json, "}", start);
        if (end > start) {
            return StringSubstr(json, start, end - start);
        }
    }

    return "";
}
//+------------------------------------------------------------------+
```
