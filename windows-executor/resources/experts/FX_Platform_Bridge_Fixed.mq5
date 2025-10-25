//+------------------------------------------------------------------+
//| FX_Platform_Bridge_Fixed.mq5                                     |
//| Fixed version with proper Windows x64 ZMQ imports                |
//+------------------------------------------------------------------+
#property copyright "FX Platform Team"
#property version   "2.00"
#property strict

//--- Import ZeroMQ with PROPER Windows x64 declarations
//--- CRITICAL: Use uchar[] for string parameters (UTF-8 encoded)
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
   int  zmq_errno();
   int  zmq_setsockopt(long socket, int option, const int &optval[], int optvallen);
#import

//--- ZeroMQ socket types
#define ZMQ_REQ   3
#define ZMQ_REP   4

//--- ZeroMQ socket options
#define ZMQ_RCVTIMEO  27
#define ZMQ_SNDTIMEO  28
#define ZMQ_LINGER    17

//--- Input parameters
input string InpServerAddress = "tcp://127.0.0.1:5555";  // Server address
input int    InpHeartbeatInterval = 30;                   // Heartbeat seconds
input int    InpTimeout = 5000;                           // Timeout milliseconds

//--- Global variables
long g_context = 0;
long g_socket = 0;
bool g_isConnected = false;
datetime g_lastHeartbeat = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=================================================================");
   Print("FX Platform Bridge - Starting (Fixed Version)");
   Print("=================================================================");
   
   // Test ZeroMQ version
   int major[1], minor[1], patch[1];
   zmq_version(major, minor, patch);
   Print("ZeroMQ Version: ", major[0], ".", minor[0], ".", patch[0]);
   
   // Initialize ZeroMQ
   if(!InitializeZeroMQ())
   {
      Print("ERROR: Failed to initialize ZeroMQ");
      return(INIT_FAILED);
   }
   
   // Connect to server
   if(!ConnectToServer())
   {
      Print("ERROR: Failed to connect to server");
      CleanupZeroMQ();
      return(INIT_FAILED);
   }
   
   // Test connection with ping
   if(!SendPing())
   {
      Print("ERROR: Ping test failed");
      CleanupZeroMQ();
      return(INIT_FAILED);
   }
   
   Print("✅ Bridge initialized successfully");
   Print("✅ Connected to: ", InpServerAddress);
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("Shutting down FX Platform Bridge...");
   CleanupZeroMQ();
   Print("Bridge stopped");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Send heartbeat every N seconds
   if(g_isConnected && TimeCurrent() - g_lastHeartbeat > InpHeartbeatInterval)
   {
      SendHeartbeat();
      g_lastHeartbeat = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| Initialize ZeroMQ context and socket                             |
//+------------------------------------------------------------------+
bool InitializeZeroMQ()
{
   // Create context
   g_context = zmq_ctx_new();
   
   if(g_context == 0)
   {
      Print("Failed to create ZeroMQ context");
      return false;
   }
   
   Print("✓ ZeroMQ context created");
   
   // Create socket (REQ type for client)
   g_socket = zmq_socket(g_context, ZMQ_REQ);
   
   if(g_socket == 0)
   {
      Print("Failed to create ZeroMQ socket");
      zmq_ctx_destroy(g_context);
      return false;
   }
   
   Print("✓ ZeroMQ socket created");
   
   // Set socket options
   int timeout[1];
   timeout[0] = InpTimeout;
   
   // Receive timeout
   zmq_setsockopt(g_socket, ZMQ_RCVTIMEO, timeout, sizeof(int));
   // Send timeout
   zmq_setsockopt(g_socket, ZMQ_SNDTIMEO, timeout, sizeof(int));
   // Linger (close immediately)
   timeout[0] = 0;
   zmq_setsockopt(g_socket, ZMQ_LINGER, timeout, sizeof(int));
   
   Print("✓ Socket options configured");
   
   return true;
}

//+------------------------------------------------------------------+
//| Connect to ZeroMQ server                                         |
//+------------------------------------------------------------------+
bool ConnectToServer()
{
   if(g_socket == 0)
   {
      Print("Socket not initialized");
      return false;
   }
   
   // Convert string to UTF-8 byte array
   uchar endpoint[];
   StringToCharArray(InpServerAddress, endpoint, 0, WHOLE_ARRAY, CP_UTF8);
   
   // Connect (add null terminator)
   ArrayResize(endpoint, ArraySize(endpoint) + 1);
   endpoint[ArraySize(endpoint) - 1] = 0;
   
   int result = zmq_connect(g_socket, endpoint);
   
   if(result != 0)
   {
      int err = zmq_errno();
      Print("Failed to connect to ", InpServerAddress);
      Print("ZMQ Error code: ", err);
      Print("Note: Error 22 = EINVAL (Invalid endpoint)");
      Print("Note: Error 156 = ENOTSUP (Protocol not supported)");
      return false;
   }
   
   g_isConnected = true;
   Print("✓ Connected to server: ", InpServerAddress);
   
   return true;
}

//+------------------------------------------------------------------+
//| Send ping to test connection                                     |
//+------------------------------------------------------------------+
bool SendPing()
{
   string request = "{\"action\":\"ping\"}";
   uchar sendBuf[];
   StringToCharArray(request, sendBuf, 0, WHOLE_ARRAY, CP_UTF8);
   
   Print("Sending ping...");
   int sent = zmq_send(g_socket, sendBuf, ArraySize(sendBuf) - 1, 0);
   
   if(sent < 0)
   {
      Print("Failed to send ping");
      return false;
   }
   
   // Receive response
   uchar recvBuf[1024];
   ArrayInitialize(recvBuf, 0);
   int received = zmq_recv(g_socket, recvBuf, 1024, 0);
   
   if(received < 0)
   {
      Print("Failed to receive pong (timeout or error)");
      return false;
   }
   
   string response = CharArrayToString(recvBuf, 0, received, CP_UTF8);
   Print("✓ Received response: ", response);
   
   return true;
}

//+------------------------------------------------------------------+
//| Send heartbeat and account info                                   |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   // Get current account info
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   double profit = AccountInfoDouble(ACCOUNT_PROFIT);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   long leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   string server = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   int openPositions = PositionsTotal();
   
   // Build account info JSON
   string accountData = "{" +
      "\"balance\":" + DoubleToString(balance, 2) + "," +
      "\"equity\":" + DoubleToString(equity, 2) + "," +
      "\"margin\":" + DoubleToString(margin, 2) + "," +
      "\"freeMargin\":" + DoubleToString(freeMargin, 2) + "," +
      "\"marginLevel\":" + DoubleToString(marginLevel, 2) + "," +
      "\"profit\":" + DoubleToString(profit, 2) + "," +
      "\"currency\":\"" + currency + "\"," +
      "\"leverage\":" + IntegerToString(leverage) + "," +
      "\"accountNumber\":\"" + IntegerToString(accountNumber) + "\"," +
      "\"server\":\"" + server + "\"," +
      "\"company\":\"" + company + "\"," +
      "\"openPositions\":" + IntegerToString(openPositions) +
   "}";
   
   // Send as update_account_info action
   string request = "{\"action\":\"update_account_info\",\"data\":" + accountData + "}";
   uchar sendBuf[];
   StringToCharArray(request, sendBuf, 0, WHOLE_ARRAY, CP_UTF8);
   
   int sent = zmq_send(g_socket, sendBuf, ArraySize(sendBuf) - 1, 0);
   
   if(sent < 0)
   {
      Print("Failed to send account info");
      return;
   }
   
   // Receive response
   uchar recvBuf[1024];
   ArrayInitialize(recvBuf, 0);
   int received = zmq_recv(g_socket, recvBuf, 1024, 0);
   
   if(received > 0)
   {
      string response = CharArrayToString(recvBuf, 0, received, CP_UTF8);
      Print("Account info updated - Balance: $", DoubleToString(balance, 2));
   }
}

//+------------------------------------------------------------------+
//| Cleanup ZeroMQ resources                                         |
//+------------------------------------------------------------------+
void CleanupZeroMQ()
{
   g_isConnected = false;
   
   if(g_socket != 0)
   {
      zmq_close(g_socket);
      g_socket = 0;
      Print("✓ Socket closed");
   }
   
   if(g_context != 0)
   {
      zmq_ctx_destroy(g_context);
      g_context = 0;
      Print("✓ Context destroyed");
   }
}
//+------------------------------------------------------------------+
