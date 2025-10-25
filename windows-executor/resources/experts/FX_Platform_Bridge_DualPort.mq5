//+------------------------------------------------------------------+
//| FX_Platform_Bridge_DualPort.mq5                                  |
//| Dual-Port Bi-Directional Bridge                                  |
//| Port 5555: Send to Executor (REQ) | Port 5556: Receive from Executor (REP) |
//+------------------------------------------------------------------+
#property copyright "FX Platform Team"
#property version   "2.00"
#property strict

//--- Import ZeroMQ with PROPER Windows x64 declarations
//--- CRITICAL: Use const uchar[] for string parameters (UTF-8 encoded)
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
input string InpPushAddress = "tcp://127.0.0.1:5555";   // Executor Server (send data)
input string InpReplyAddress = "tcp://127.0.0.1:5556";  // EA Server (receive commands)
input int    InpDataInterval = 1;                       // Market data send interval (seconds)

//--- Global variables for PUSH connection (send to Executor)
long g_contextPush = 0;
long g_socketPush = 0;
bool g_isPushConnected = false;

//--- Global variables for REPLY connection (receive from Executor)
long g_contextReply = 0;
long g_socketReply = 0;
bool g_isReplyBound = false;

//--- Timers
datetime g_lastDataSend = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=================================================================");
   Print("FX Platform Bridge - DUAL PORT VERSION");
   Print("=================================================================");
   
   // Test ZeroMQ version
   int major[1], minor[1], patch[1];
   zmq_version(major, minor, patch);
   Print("ZeroMQ Version: ", major[0], ".", minor[0], ".", patch[0]);
   
   // Initialize PUSH connection (send to Executor)
   if(!InitializePushConnection())
   {
      Print("ERROR: Failed to initialize PUSH connection to Executor");
      return(INIT_FAILED);
   }
   
   // Initialize REPLY connection (receive from Executor)
   if(!InitializeReplyConnection())
   {
      Print("ERROR: Failed to initialize REPLY connection");
      CleanupPushConnection(); // Clean up first connection
      return(INIT_FAILED);
   }
   
   Print("✅ Bridge initialized successfully");
   Print("✅ Connected to Executor on port 5555 (PUSH)");
   Print("✅ Listening for commands on port 5556 (REPLY)");
   
   // Set timer to send data every second (independent of ticks)
   EventSetTimer(InpDataInterval);
   Print("✓ Timer set to ", InpDataInterval, " second(s)");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("Shutting down FX Platform Bridge...");
   
   // Kill timer
   EventKillTimer();
   
   CleanupPushConnection();
   CleanupReplyConnection();
   Print("✅ Bridge stopped");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check for incoming commands from Executor (non-blocking)
   CheckForCommands();
}

//+------------------------------------------------------------------+
//| Timer function - called every second                             |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Send data every timer tick (every InpDataInterval seconds)
   SendMarketData();
   SendAccountInfo();
   
   // Also check for commands
   CheckForCommands();
}

//+------------------------------------------------------------------+
//| Initialize PUSH connection to Executor                          |
//+------------------------------------------------------------------+
bool InitializePushConnection()
{
   // Create context
   g_contextPush = zmq_ctx_new();
   if(g_contextPush == 0)
   {
      Print("Failed to create ZeroMQ PUSH context");
      return false;
   }
   Print("✓ PUSH context created");
   
   // Create REQ socket for sending to Executor
   g_socketPush = zmq_socket(g_contextPush, ZMQ_REQ);
   if(g_socketPush == 0)
   {
      Print("Failed to create PUSH socket");
      zmq_ctx_destroy(g_contextPush);
      return false;
   }
   Print("✓ PUSH socket created (REQ type)");
   
   // Set socket options for better connection handling
   int linger[1];
   linger[0] = 0;  // Don't wait on close
   zmq_setsockopt(g_socketPush, ZMQ_LINGER, linger, sizeof(int));
   
   int immediate[1];
   immediate[0] = 1;  // Queue messages only to completed connections
   zmq_setsockopt(g_socketPush, ZMQ_IMMEDIATE, immediate, sizeof(int));
   
   int timeout[1];
   timeout[0] = 5000;  // 5 second timeout
   zmq_setsockopt(g_socketPush, ZMQ_RCVTIMEO, timeout, sizeof(int));
   zmq_setsockopt(g_socketPush, ZMQ_SNDTIMEO, timeout, sizeof(int));
   
   Print("✓ Socket options configured");
   
   // Convert address string to UTF-8 byte array
   uchar pushEndpoint[];
   StringToCharArray(InpPushAddress, pushEndpoint, 0, WHOLE_ARRAY, CP_UTF8);
   
   // Add null terminator
   ArrayResize(pushEndpoint, ArraySize(pushEndpoint) + 1);
   pushEndpoint[ArraySize(pushEndpoint) - 1] = 0;
   
   // Connect to Executor server
   int result = zmq_connect(g_socketPush, pushEndpoint);
   if(result != 0)
   {
      int err = zmq_errno();
      Print("Failed to connect to ", InpPushAddress);
      Print("ZMQ Error code: ", err);
      return false;
   }
   
   g_isPushConnected = true;
   Print("✓ Connected to Executor: ", InpPushAddress);
   
   return true;
}

//+------------------------------------------------------------------+
//| Initialize REPLY connection for receiving commands              |
//+------------------------------------------------------------------+
bool InitializeReplyConnection()
{
   // Create context
   g_contextReply = zmq_ctx_new();
   if(g_contextReply == 0)
   {
      Print("Failed to create ZeroMQ REPLY context");
      return false;
   }
   Print("✓ REPLY context created");
   
   // Create REP socket for receiving from Executor
   g_socketReply = zmq_socket(g_contextReply, ZMQ_REP);
   if(g_socketReply == 0)
   {
      Print("Failed to create REPLY socket");
      zmq_ctx_destroy(g_contextReply);
      return false;
   }
   Print("✓ REPLY socket created (REP type)");
   
   // Set socket options
   int linger[1];
   linger[0] = 0;
   zmq_setsockopt(g_socketReply, ZMQ_LINGER, linger, sizeof(int));
   
   int timeout[1];
   timeout[0] = 1000;  // 1 second timeout for non-blocking recv
   zmq_setsockopt(g_socketReply, ZMQ_RCVTIMEO, timeout, sizeof(int));
   
   Print("✓ REPLY socket options configured");
   
   // Convert address string to UTF-8 byte array
   uchar replyEndpoint[];
   StringToCharArray(InpReplyAddress, replyEndpoint, 0, WHOLE_ARRAY, CP_UTF8);
   
   // Add null terminator
   ArrayResize(replyEndpoint, ArraySize(replyEndpoint) + 1);
   replyEndpoint[ArraySize(replyEndpoint) - 1] = 0;
   
   // Bind to port 5556
   int result = zmq_bind(g_socketReply, replyEndpoint);
   if(result != 0)
   {
      int err = zmq_errno();
      Print("Failed to bind to ", InpReplyAddress);
      Print("ZMQ Error code: ", err);
      return false;
   }
   
   g_isReplyBound = true;
   Print("✓ Listening on: ", InpReplyAddress);
   
   return true;
}

//+------------------------------------------------------------------+
//| Send market data to Executor                                     |
//+------------------------------------------------------------------+
void SendMarketData()
{
   if(!g_isPushConnected || g_socketPush == 0)
      return;
   
   // Prepare JSON
   string json = "{";
   json += "\"action\":\"market_data\",";
   json += "\"data\":{";
   json += "\"symbol\":\"" + Symbol() + "\",";
   json += "\"bid\":" + DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_BID), 5) + ",";
   json += "\"ask\":" + DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_ASK), 5) + ",";
   json += "\"time\":" + IntegerToString(TimeCurrent()) + ",";
   json += "\"spread\":" + IntegerToString(SymbolInfoInteger(Symbol(), SYMBOL_SPREAD));
   json += "}}";
   
   // Convert to bytes
   uchar data[];
   int len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   
   // Send to Executor
   int sent = zmq_send(g_socketPush, data, len, 0);
   if(sent == -1)
   {
      int err = zmq_errno();
      Print("❌ Failed to send market data, error: ", err);
      return;
   }
   
   // Wait for acknowledgment
   uchar recv_data[1024];
   int recv_size = zmq_recv(g_socketPush, recv_data, 1024, 0);
   if(recv_size > 0)
   {
      string response = CharArrayToString(recv_data, 0, recv_size, CP_UTF8);
      Print("📊 Market data sent: ", Symbol(), " Bid=", DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_BID), 5));
   }
   else
   {
      Print("⚠️ No response for market data");
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
      int err = zmq_errno();
      Print("❌ Failed to send account info, error: ", err);
      return;
   }
   
   // Wait for acknowledgment
   uchar recv_data[1024];
   int recv_size = zmq_recv(g_socketPush, recv_data, 1024, 0);
   if(recv_size > 0)
   {
      Print("💰 Account sent: Balance=$", DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2));
   }
   else
   {
      Print("⚠️ No response for account info");
   }
}

//+------------------------------------------------------------------+
//| Check for incoming commands from Executor                        |
//+------------------------------------------------------------------+
void CheckForCommands()
{
   if(!g_isReplyBound || g_socketReply == 0)
      return;
   
   uchar buffer[4096];
   
   // Non-blocking receive
   int recv_size = zmq_recv(g_socketReply, buffer, 4096, ZMQ_DONTWAIT);
   
   if(recv_size > 0)
   {
      string request = CharArrayToString(buffer, 0, recv_size, CP_UTF8);
      Print("📨 Command received: ", request);
      
      // Process command
      string response = ProcessCommand(request);
      
      // Send response
      uchar response_data[];
      int resp_len = StringToCharArray(response, response_data, 0, WHOLE_ARRAY, CP_UTF8) - 1;
      zmq_send(g_socketReply, response_data, resp_len, 0);
   }
}

//+------------------------------------------------------------------+
//| Process command from Executor                                    |
//+------------------------------------------------------------------+
string ProcessCommand(string request)
{
   // Parse command type
   if(StringFind(request, "\"command\":\"GET_BARS\"") >= 0)
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
   else if(StringFind(request, "\"command\":\"GET_ACCOUNT_INFO\"") >= 0)
   {
      return GetAccountInfoJSON();
   }
   else if(StringFind(request, "\"command\":\"PING\"") >= 0)
   {
      return "{\"status\":\"OK\",\"message\":\"pong\"}";
   }
   
   return "{\"status\":\"ERROR\",\"error\":\"Unknown command\"}";
}

//+------------------------------------------------------------------+
//| Get historical bars                                              |
//+------------------------------------------------------------------+
string GetHistoricalBars(string request)
{
   // Parse parameters from request
   // For now, return sample data
   string json = "{\"status\":\"OK\",\"data\":{\"bars\":[";
   
   MqlRates rates[];
   int copied = CopyRates(Symbol(), PERIOD_M1, 0, 10, rates);
   
   if(copied > 0)
   {
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
   }
   
   json += "]}}";
   return json;
}

//+------------------------------------------------------------------+
//| Execute open position                                            |
//+------------------------------------------------------------------+
string ExecuteOpenPosition(string request)
{
   // TODO: Parse trade parameters and execute
   // For now, return placeholder
   return "{\"status\":\"OK\",\"data\":{\"ticket\":123456,\"message\":\"Trade executed\"}}";
}

//+------------------------------------------------------------------+
//| Execute close position                                           |
//+------------------------------------------------------------------+
string ExecuteClosePosition(string request)
{
   // TODO: Parse ticket and close position
   return "{\"status\":\"OK\",\"message\":\"Position closed\"}";
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
   json += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2);
   json += "}}";
   return json;
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
      Print("✓ PUSH socket closed");
   }
   
   if(g_contextPush != 0)
   {
      zmq_ctx_destroy(g_contextPush);
      g_contextPush = 0;
      Print("✓ PUSH context destroyed");
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
      Print("✓ REPLY socket closed");
   }
   
   if(g_contextReply != 0)
   {
      zmq_ctx_destroy(g_contextReply);
      g_contextReply = 0;
      Print("✓ REPLY context destroyed");
   }
   
   g_isReplyBound = false;
}
//+------------------------------------------------------------------+
