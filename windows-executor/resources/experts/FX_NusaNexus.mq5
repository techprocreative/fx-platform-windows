//+------------------------------------------------------------------+
//| FX_NusaNexus.mq5                                                 |
//| Advanced Bi-Directional Trading Bridge                          |
//| Port 5555: Send to Executor | Port 5556: Receive Commands       |
//+------------------------------------------------------------------+
#property copyright "NusaNexus Trading Systems"
#property version   "1.00"
#property strict

//--- Import ZeroMQ with Windows x64 declarations
#import "libzmq.dll"
   void zmq_version(int &major[], int &minor[], int &patch[]);
   long zmq_ctx_new();
   int  zmq_ctx_destroy(long context);
   long zmq_socket(long context, int type);
   int  zmq_close(long socket);
   int  zmq_bind(long socket, const uchar &endpoint[]);
   int  zmq_connect(long socket, const uchar &endpoint[]);
   int  zmq_send(long socket, const uchar &buf[], int len, int flags);
   int  zmq_recv(long socket, uchar &buf[], int len, int flags);
   int  zmq_setsockopt(long socket, int option, const int &optval[], int optvallen);
   int  zmq_errno();
#import

//--- ZeroMQ socket types
#define ZMQ_REP   4
#define ZMQ_REQ   3
#define ZMQ_DONTWAIT 1

//--- ZeroMQ socket options
#define ZMQ_LINGER 17
#define ZMQ_RCVTIMEO 27
#define ZMQ_SNDTIMEO 28
#define ZMQ_IMMEDIATE 39

//--- Input parameters
input string InpPushAddress = "tcp://127.0.0.1:5555";   // Executor Server
input string InpReplyAddress = "tcp://127.0.0.1:5556";  // EA Server
input int    InpDataInterval = 1;                       // Data send interval (seconds)

//--- Global variables for PUSH connection
long g_contextPush = 0;
long g_socketPush = 0;
bool g_isPushConnected = false;

//--- Global variables for REPLY connection
long g_contextReply = 0;
long g_socketReply = 0;
bool g_isReplyBound = false;

//--- Trade management
#include <Trade\Trade.mqh>
CTrade trade;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=================================================================");
   Print("FX NusaNexus Bridge - Advanced Trading System");
   Print("=================================================================");
   
   // Test ZeroMQ version
   int major[1], minor[1], patch[1];
   zmq_version(major, minor, patch);
   Print("ZeroMQ Version: ", major[0], ".", minor[0], ".", patch[0]);
   
   // Initialize PUSH connection
   if(!InitializePushConnection())
   {
      Print("ERROR: Failed to initialize PUSH connection");
      return(INIT_FAILED);
   }
   
   // Initialize REPLY connection
   if(!InitializeReplyConnection())
   {
      Print("ERROR: Failed to initialize REPLY connection");
      CleanupPushConnection();
      return(INIT_FAILED);
   }
   
   Print("✅ NusaNexus Bridge initialized successfully");
   Print("✅ Connected to Executor on port 5555");
   Print("✅ Listening for commands on port 5556");
   
   // Set timer
   EventSetTimer(InpDataInterval);
   Print("✓ Timer set to ", InpDataInterval, " second(s)");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("Shutting down NusaNexus Bridge...");
   EventKillTimer();
   CleanupPushConnection();
   CleanupReplyConnection();
   Print("✅ NusaNexus Bridge stopped");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   CheckForCommands();
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // DISABLED: SendMarketData();  // Executor will REQUEST when needed via GET_BARS
   // DISABLED: SendAccountInfo();  // Executor will REQUEST when needed 
   CheckForCommands();  // Only listen for commands
}

//+------------------------------------------------------------------+
//| Initialize PUSH connection                                       |
//+------------------------------------------------------------------+
bool InitializePushConnection()
{
   g_contextPush = zmq_ctx_new();
   if(g_contextPush == 0)
   {
      Print("Failed to create ZeroMQ PUSH context");
      return false;
   }
   
   g_socketPush = zmq_socket(g_contextPush, ZMQ_REQ);
   if(g_socketPush == 0)
   {
      Print("Failed to create PUSH socket");
      zmq_ctx_destroy(g_contextPush);
      return false;
   }
   
   // Set socket options
   int linger[1] = {0};
   zmq_setsockopt(g_socketPush, ZMQ_LINGER, linger, sizeof(int));
   
   int timeout[1] = {5000};
   zmq_setsockopt(g_socketPush, ZMQ_SNDTIMEO, timeout, sizeof(int));
   zmq_setsockopt(g_socketPush, ZMQ_RCVTIMEO, timeout, sizeof(int));
   
   // Connect to Executor
   uchar address[];
   StringToCharArray(InpPushAddress, address, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(address, ArraySize(address) + 1);
   address[ArraySize(address) - 1] = 0;
   
   if(zmq_connect(g_socketPush, address) == -1)
   {
      Print("Failed to connect PUSH socket to ", InpPushAddress);
      zmq_close(g_socketPush);
      zmq_ctx_destroy(g_contextPush);
      return false;
   }
   
   g_isPushConnected = true;
   Print("✓ PUSH connection established");
   return true;
}

//+------------------------------------------------------------------+
//| Initialize REPLY connection                                      |
//+------------------------------------------------------------------+
bool InitializeReplyConnection()
{
   g_contextReply = zmq_ctx_new();
   if(g_contextReply == 0)
   {
      Print("Failed to create ZeroMQ REPLY context");
      return false;
   }
   
   g_socketReply = zmq_socket(g_contextReply, ZMQ_REP);
   if(g_socketReply == 0)
   {
      Print("Failed to create REPLY socket");
      zmq_ctx_destroy(g_contextReply);
      return false;
   }
   
   // Set socket options
   int linger[1] = {0};
   zmq_setsockopt(g_socketReply, ZMQ_LINGER, linger, sizeof(int));
   
   int timeout[1] = {100};
   zmq_setsockopt(g_socketReply, ZMQ_RCVTIMEO, timeout, sizeof(int));
   
   // Bind to address
   uchar address[];
   StringToCharArray(InpReplyAddress, address, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(address, ArraySize(address) + 1);
   address[ArraySize(address) - 1] = 0;
   
   if(zmq_bind(g_socketReply, address) == -1)
   {
      Print("Failed to bind REPLY socket to ", InpReplyAddress);
      zmq_close(g_socketReply);
      zmq_ctx_destroy(g_contextReply);
      return false;
   }
   
   g_isReplyBound = true;
   Print("✓ REPLY connection bound");
   return true;
}

//+------------------------------------------------------------------+
//| Send market data to Executor                                     |
//+------------------------------------------------------------------+
void SendMarketData()
{
   if(!g_isPushConnected || g_socketPush == 0)
      return;
   
   string json = "{";
   json += "\"action\":\"market_data\",";
   json += "\"data\":{";
   json += "\"symbol\":\"" + Symbol() + "\",";
   json += "\"bid\":" + DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_BID), 5) + ",";
   json += "\"ask\":" + DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_ASK), 5) + ",";
   json += "\"time\":" + IntegerToString(TimeCurrent()) + ",";
   json += "\"spread\":" + IntegerToString(SymbolInfoInteger(Symbol(), SYMBOL_SPREAD));
   json += "}}";
   
   uchar data[];
   int len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   
   int sent = zmq_send(g_socketPush, data, len, 0);
   if(sent == -1)
   {
      Print("❌ Failed to send market data");
      return;
   }
   
   uchar recv_data[1024];
   int recv_size = zmq_recv(g_socketPush, recv_data, 1024, 0);
   if(recv_size > 0)
   {
      Print("📊 Market data sent: ", Symbol(), " Bid=", DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_BID), 5));
   }
}

//+------------------------------------------------------------------+
//| Send account info to Executor                                    |
//+------------------------------------------------------------------+
void SendAccountInfo()
{
   if(!g_isPushConnected || g_socketPush == 0)
      return;
   
   string json = "{";
   json += "\"action\":\"account_info\",";
   json += "\"data\":{";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   json += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   json += "\"profit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   json += "}}";
   
   uchar data[];
   int len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   
   int sent = zmq_send(g_socketPush, data, len, 0);
   if(sent == -1)
   {
      Print("❌ Failed to send account info");
      return;
   }
   
   uchar recv_data[1024];
   int recv_size = zmq_recv(g_socketPush, recv_data, 1024, 0);
   if(recv_size > 0)
   {
      Print("💰 Account sent: Balance=$", DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2));
   }
}

//+------------------------------------------------------------------+
//| Check for incoming commands                                      |
//+------------------------------------------------------------------+
void CheckForCommands()
{
   if(!g_isReplyBound || g_socketReply == 0)
      return;
   
   uchar recv_data[4096];
   int recv_size = zmq_recv(g_socketReply, recv_data, 4096, ZMQ_DONTWAIT);
   
   if(recv_size > 0)
   {
      string request = CharArrayToString(recv_data, 0, recv_size, CP_UTF8);
      Print("📨 Received command: ", StringSubstr(request, 0, 100), "...");
      
      string response = ProcessCommand(request);
      
      uchar response_data[];
      int response_len = StringToCharArray(response, response_data, 0, WHOLE_ARRAY, CP_UTF8) - 1;
      zmq_send(g_socketReply, response_data, response_len, 0);
   }
}

//+------------------------------------------------------------------+
//| Process command and return response                              |
//+------------------------------------------------------------------+
string ProcessCommand(string request)
{
   // Route to appropriate handler
   if(StringFind(request, "\"command\":\"PING\"") >= 0)
   {
      // Handle PING command for connection test
      ulong startTime = GetTickCount64();
      ulong executionTime = GetTickCount64() - startTime;
      return "{\"status\":\"OK\",\"message\":\"PONG\",\"executionTime\":" + IntegerToString((long)executionTime) + "}";
   }
   else if(StringFind(request, "\"command\":\"GET_BARS\"") >= 0)
   {
      return GetHistoricalBars(request);
   }
   else if(StringFind(request, "\"command\":\"OPEN_POSITION\"") >= 0)
   {
      return ExecuteOpenPosition(request);
   }
   else if(StringFind(request, "\"command\":\"CLOSE_POSITION\"") >= 0)
   {
      return ExecuteClosePosition(request);
   }
   else if(StringFind(request, "\"command\":\"GET_ACCOUNT\"") >= 0)
   {
      return GetAccountInfoJSON();
   }
   else if(StringFind(request, "\"command\":\"GET_PRICE\"") >= 0)
   {
      return GetCurrentPrice(request);
   }
   
   return "{\"status\":\"ERROR\",\"message\":\"Unknown command\"}";
}

//+------------------------------------------------------------------+
//| Get historical bars - FIXED VERSION                             |
//+------------------------------------------------------------------+
string GetHistoricalBars(string request)
{
   // Parse parameters from JSON request
   string symbol = ParseStringParam(request, "symbol");
   string timeframeStr = ParseStringParam(request, "timeframe");
   int barsCount = (int)ParseNumberParam(request, "bars");
   
   // Default values if parsing fails
   if(symbol == "") symbol = Symbol();
   if(barsCount <= 0) barsCount = 100;
   
   // Convert timeframe string to ENUM_TIMEFRAMES
   ENUM_TIMEFRAMES timeframe = StringToTimeframe(timeframeStr);
   
   Print("📊 GET_BARS: ", symbol, " ", EnumToString(timeframe), " Bars=", barsCount);
   
   // Get bars from MT5
   MqlRates rates[];
   int copied = CopyRates(symbol, timeframe, 0, barsCount, rates);
   
   if(copied <= 0)
   {
      int error = GetLastError();
      string errorMsg = "Failed to copy rates: Error " + IntegerToString(error);
      Print("❌ ", errorMsg);
      return "{\"status\":\"ERROR\",\"message\":\"" + errorMsg + "\"}";
   }
   
   // Build JSON response
   string json = "{\"status\":\"OK\",\"data\":{";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"timeframe\":\"" + timeframeStr + "\",";
   json += "\"bars\":[";
   
   for(int i = 0; i < copied; i++)
   {
      if(i > 0) json += ",";
      json += "{";
      json += "\"time\":" + IntegerToString(rates[i].time) + ",";
      json += "\"open\":" + DoubleToString(rates[i].open, 5) + ",";
      json += "\"high\":" + DoubleToString(rates[i].high, 5) + ",";
      json += "\"low\":" + DoubleToString(rates[i].low, 5) + ",";
      json += "\"close\":" + DoubleToString(rates[i].close, 5) + ",";
      json += "\"volume\":" + IntegerToString(rates[i].tick_volume);
      json += "}";
   }
   
   json += "]}}";
   
   Print("✅ Sent ", copied, " bars for ", symbol, " ", EnumToString(timeframe));
   return json;
}

//+------------------------------------------------------------------+
//| Get current price                                                |
//+------------------------------------------------------------------+
string GetCurrentPrice(string request)
{
   string symbol = ParseStringParam(request, "symbol");
   if(symbol == "") symbol = Symbol();
   
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   
   if(bid == 0 || ask == 0)
   {
      return "{\"status\":\"ERROR\",\"message\":\"Symbol not found or no price\"}";
   }
   
   string json = "{\"status\":\"OK\",\"data\":{";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"bid\":" + DoubleToString(bid, 5) + ",";
   json += "\"ask\":" + DoubleToString(ask, 5) + ",";
   json += "\"spread\":" + IntegerToString((int)SymbolInfoInteger(symbol, SYMBOL_SPREAD));
   json += "}}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Execute open position                                            |
//+------------------------------------------------------------------+
string ExecuteOpenPosition(string request)
{
   // Parse trade parameters
   string symbol = ParseStringParam(request, "symbol");
   string actionStr = ParseStringParam(request, "action");
   double lotSize = ParseNumberParam(request, "lotSize");
   double stopLoss = ParseNumberParam(request, "stopLoss");
   double takeProfit = ParseNumberParam(request, "takeProfit");
   string comment = ParseStringParam(request, "comment");
   
   if(symbol == "") symbol = Symbol();
   if(comment == "") comment = "NusaNexus";
   
   Print("🔷 OPEN_POSITION: ", actionStr, " ", symbol, " Lot=", lotSize, " SL=", stopLoss, " TP=", takeProfit);
   
   // Determine order type
   ENUM_ORDER_TYPE orderType;
   if(actionStr == "BUY" || actionStr == "buy")
      orderType = ORDER_TYPE_BUY;
   else if(actionStr == "SELL" || actionStr == "sell")
      orderType = ORDER_TYPE_SELL;
   else
   {
      return "{\"status\":\"ERROR\",\"message\":\"Invalid action: " + actionStr + "\"}";
   }
   
   // Get current price
   double price = (orderType == ORDER_TYPE_BUY) ? 
                  SymbolInfoDouble(symbol, SYMBOL_ASK) : 
                  SymbolInfoDouble(symbol, SYMBOL_BID);
   
   // Execute trade
   trade.SetDeviationInPoints(10);
   trade.SetTypeFilling(ORDER_FILLING_IOC);
   
   bool success = trade.PositionOpen(
      symbol,
      orderType,
      lotSize,
      price,
      stopLoss,
      takeProfit,
      comment
   );
   
   if(success)
   {
      ulong ticket = trade.ResultOrder();
      Print("✅ Position opened: Ticket=", ticket);
      
      string json = "{\"status\":\"OK\",\"data\":{";
      json += "\"ticket\":" + IntegerToString((long)ticket) + ",";
      json += "\"symbol\":\"" + symbol + "\",";
      json += "\"action\":\"" + actionStr + "\",";
      json += "\"lotSize\":" + DoubleToString(lotSize, 2) + ",";
      json += "\"openPrice\":" + DoubleToString(price, 5) + ",";
      json += "\"stopLoss\":" + DoubleToString(stopLoss, 5) + ",";
      json += "\"takeProfit\":" + DoubleToString(takeProfit, 5);
      json += "}}";
      return json;
   }
   else
   {
      uint errorCode = trade.ResultRetcode();
      string errorMsg = "Trade failed: " + IntegerToString(errorCode);
      Print("❌ ", errorMsg);
      return "{\"status\":\"ERROR\",\"message\":\"" + errorMsg + "\"}";
   }
}

//+------------------------------------------------------------------+
//| Execute close position                                           |
//+------------------------------------------------------------------+
string ExecuteClosePosition(string request)
{
   ulong ticket = (ulong)ParseNumberParam(request, "ticket");
   
   if(ticket <= 0)
   {
      return "{\"status\":\"ERROR\",\"message\":\"Invalid ticket\"}";
   }
   
   Print("🔶 CLOSE_POSITION: Ticket=", ticket);
   
   if(PositionSelectByTicket(ticket))
   {
      bool success = trade.PositionClose(ticket);
      
      if(success)
      {
         Print("✅ Position closed: Ticket=", ticket);
         return "{\"status\":\"OK\",\"message\":\"Position closed\"}";
      }
      else
      {
         uint errorCode = trade.ResultRetcode();
         string errorMsg = "Close failed: " + IntegerToString(errorCode);
         Print("❌ ", errorMsg);
         return "{\"status\":\"ERROR\",\"message\":\"" + errorMsg + "\"}";
      }
   }
   else
   {
      return "{\"status\":\"ERROR\",\"message\":\"Position not found\"}";
   }
}

//+------------------------------------------------------------------+
//| Get account info as JSON                                         |
//+------------------------------------------------------------------+
string GetAccountInfoJSON()
{
   string json = "{\"status\":\"OK\",\"data\":{";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   json += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   json += "\"profit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   json += "}}";
   return json;
}

//+------------------------------------------------------------------+
//| Convert timeframe string to ENUM_TIMEFRAMES                      |
//+------------------------------------------------------------------+
ENUM_TIMEFRAMES StringToTimeframe(string tf)
{
   if(tf == "M1" || tf == "1")  return PERIOD_M1;
   if(tf == "M5" || tf == "5")  return PERIOD_M5;
   if(tf == "M15" || tf == "15") return PERIOD_M15;
   if(tf == "M30" || tf == "30") return PERIOD_M30;
   if(tf == "H1" || tf == "60")  return PERIOD_H1;
   if(tf == "H4" || tf == "240") return PERIOD_H4;
   if(tf == "D1" || tf == "1440") return PERIOD_D1;
   if(tf == "W1" || tf == "10080") return PERIOD_W1;
   if(tf == "MN1" || tf == "43200") return PERIOD_MN1;
   
   // Default to M15
   return PERIOD_M15;
}

//+------------------------------------------------------------------+
//| Parse string parameter from JSON                                 |
//+------------------------------------------------------------------+
string ParseStringParam(string json, string key)
{
   string searchKey = "\"" + key + "\":\"";
   int startPos = StringFind(json, searchKey);
   
   if(startPos == -1)
      return "";
   
   startPos += StringLen(searchKey);
   int endPos = StringFind(json, "\"", startPos);
   
   if(endPos == -1)
      return "";
   
   return StringSubstr(json, startPos, endPos - startPos);
}

//+------------------------------------------------------------------+
//| Parse number parameter from JSON                                 |
//+------------------------------------------------------------------+
double ParseNumberParam(string json, string key)
{
   string searchKey = "\"" + key + "\":";
   int startPos = StringFind(json, searchKey);
   
   if(startPos == -1)
      return 0;
   
   startPos += StringLen(searchKey);
   
   // Find end of number (comma, brace, or bracket)
   string remaining = StringSubstr(json, startPos);
   int endPos = 0;
   
   for(int i = 0; i < StringLen(remaining); i++)
   {
      ushort ch = StringGetCharacter(remaining, i);
      if(ch == ',' || ch == '}' || ch == ']' || ch == ' ')
      {
         endPos = i;
         break;
      }
   }
   
   if(endPos == 0)
      endPos = StringLen(remaining);
   
   string numStr = StringSubstr(remaining, 0, endPos);
   return StringToDouble(numStr);
}

//+------------------------------------------------------------------+
//| Cleanup PUSH connection                                          |
//+------------------------------------------------------------------+
void CleanupPushConnection()
{
   if(g_socketPush != 0)
   {
      zmq_close(g_socketPush);
      g_socketPush = 0;
   }
   
   if(g_contextPush != 0)
   {
      zmq_ctx_destroy(g_contextPush);
      g_contextPush = 0;
   }
   
   g_isPushConnected = false;
}

//+------------------------------------------------------------------+
//| Cleanup REPLY connection                                         |
//+------------------------------------------------------------------+
void CleanupReplyConnection()
{
   if(g_socketReply != 0)
   {
      zmq_close(g_socketReply);
      g_socketReply = 0;
   }
   
   if(g_contextReply != 0)
   {
      zmq_ctx_destroy(g_contextReply);
      g_contextReply = 0;
   }
   
   g_isReplyBound = false;
}
//+------------------------------------------------------------------+
