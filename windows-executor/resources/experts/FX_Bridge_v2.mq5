//+------------------------------------------------------------------+
//| FX_Bridge_v2.mq5                                                  |
//| Fresh EA with complete account sync                              |
//+------------------------------------------------------------------+
#property copyright "FX Platform Team"
#property version   "2.00"
#property strict

//--- Import ZeroMQ with proper Windows x64 declarations
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

//--- ZeroMQ constants
#define ZMQ_REQ       3
#define ZMQ_RCVTIMEO  27
#define ZMQ_SNDTIMEO  28
#define ZMQ_LINGER    17

//--- Input parameters
input string InpServerAddress = "tcp://127.0.0.1:5555";  // Server address
input int    InpSyncInterval = 30;                        // Sync interval (seconds)
input int    InpTimeout = 5000;                           // Socket timeout (ms)

//--- Global variables
long g_context = 0;
long g_socket = 0;
bool g_connected = false;
datetime g_lastSync = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("========================================");
   Print("FX Bridge v2 - Initializing");
   Print("========================================");
   
   // Check ZeroMQ version
   int major[1], minor[1], patch[1];
   zmq_version(major, minor, patch);
   Print("ZeroMQ Version: ", major[0], ".", minor[0], ".", patch[0]);
   
   // Initialize ZeroMQ
   if(!InitZMQ())
   {
      Print("ERROR: Failed to initialize ZeroMQ");
      return INIT_FAILED;
   }
   
   // Connect to server
   if(!ConnectServer())
   {
      Print("ERROR: Failed to connect to server");
      ShutdownZMQ();
      return INIT_FAILED;
   }
   
   // Test with ping
   if(!TestConnection())
   {
      Print("ERROR: Connection test failed");
      ShutdownZMQ();
      return INIT_FAILED;
   }
   
   // Send initial account info
   SendAccountInfo();
   g_lastSync = TimeCurrent();
   
   Print("========================================");
   Print("✅ FX Bridge v2 - Ready");
   Print("✅ Connected to: ", InpServerAddress);
   Print("✅ Sync interval: ", InpSyncInterval, " seconds");
   Print("========================================");
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("FX Bridge v2 - Shutting down...");
   ShutdownZMQ();
   Print("FX Bridge v2 - Stopped");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!g_connected) return;
   
   // Sync account info periodically
   if(TimeCurrent() - g_lastSync >= InpSyncInterval)
   {
      SendAccountInfo();
      g_lastSync = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| Initialize ZeroMQ                                                |
//+------------------------------------------------------------------+
bool InitZMQ()
{
   // Create context
   g_context = zmq_ctx_new();
   if(g_context == 0)
   {
      Print("Failed to create ZMQ context");
      return false;
   }
   Print("✓ ZMQ context created");
   
   // Create socket
   g_socket = zmq_socket(g_context, ZMQ_REQ);
   if(g_socket == 0)
   {
      Print("Failed to create ZMQ socket");
      zmq_ctx_destroy(g_context);
      return false;
   }
   Print("✓ ZMQ socket created");
   
   // Set socket options
   int timeout[1];
   timeout[0] = InpTimeout;
   zmq_setsockopt(g_socket, ZMQ_RCVTIMEO, timeout, sizeof(int));
   zmq_setsockopt(g_socket, ZMQ_SNDTIMEO, timeout, sizeof(int));
   timeout[0] = 0;
   zmq_setsockopt(g_socket, ZMQ_LINGER, timeout, sizeof(int));
   Print("✓ Socket options set");
   
   return true;
}

//+------------------------------------------------------------------+
//| Connect to server                                                |
//+------------------------------------------------------------------+
bool ConnectServer()
{
   if(g_socket == 0) return false;
   
   // Convert address to UTF-8 byte array
   uchar addr[];
   StringToCharArray(InpServerAddress, addr, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(addr, ArraySize(addr) + 1);
   addr[ArraySize(addr) - 1] = 0;
   
   // Connect
   int result = zmq_connect(g_socket, addr);
   if(result != 0)
   {
      int err = zmq_errno();
      Print("Connection failed - Error: ", err);
      return false;
   }
   
   g_connected = true;
   Print("✓ Connected to ", InpServerAddress);
   
   return true;
}

//+------------------------------------------------------------------+
//| Test connection with ping                                        |
//+------------------------------------------------------------------+
bool TestConnection()
{
   string req = "{\"action\":\"ping\"}";
   string resp = SendRequest(req);
   
   if(StringLen(resp) > 0)
   {
      Print("✓ Ping successful");
      return true;
   }
   
   Print("Ping failed");
   return false;
}

//+------------------------------------------------------------------+
//| Send account info to server                                      |
//+------------------------------------------------------------------+
void SendAccountInfo()
{
   // Get account data
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   double profit = AccountInfoDouble(ACCOUNT_PROFIT);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   long leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
   long accountNum = AccountInfoInteger(ACCOUNT_LOGIN);
   string server = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   int positions = PositionsTotal();
   
   // Build JSON
   string data = "{" +
      "\"balance\":" + DoubleToString(balance, 2) + "," +
      "\"equity\":" + DoubleToString(equity, 2) + "," +
      "\"margin\":" + DoubleToString(margin, 2) + "," +
      "\"freeMargin\":" + DoubleToString(freeMargin, 2) + "," +
      "\"marginLevel\":" + DoubleToString(marginLevel, 2) + "," +
      "\"profit\":" + DoubleToString(profit, 2) + "," +
      "\"currency\":\"" + currency + "\"," +
      "\"leverage\":" + IntegerToString(leverage) + "," +
      "\"accountNumber\":\"" + IntegerToString(accountNum) + "\"," +
      "\"server\":\"" + server + "\"," +
      "\"company\":\"" + company + "\"," +
      "\"openPositions\":" + IntegerToString(positions) +
   "}";
   
   string request = "{\"action\":\"update_account_info\",\"data\":" + data + "}";
   string response = SendRequest(request);
   
   if(StringLen(response) > 0)
   {
      Print("Account synced - Balance: $", DoubleToString(balance, 2), 
            " | Equity: $", DoubleToString(equity, 2),
            " | Positions: ", positions);
   }
   else
   {
      Print("Failed to sync account info");
   }
}

//+------------------------------------------------------------------+
//| Send request and get response                                    |
//+------------------------------------------------------------------+
string SendRequest(string request)
{
   if(!g_connected || g_socket == 0) return "";
   
   // Send
   uchar sendBuf[];
   StringToCharArray(request, sendBuf, 0, WHOLE_ARRAY, CP_UTF8);
   
   int sent = zmq_send(g_socket, sendBuf, ArraySize(sendBuf) - 1, 0);
   if(sent < 0)
   {
      Print("Send failed");
      return "";
   }
   
   // Receive
   uchar recvBuf[2048];
   ArrayInitialize(recvBuf, 0);
   int received = zmq_recv(g_socket, recvBuf, 2048, 0);
   
   if(received <= 0)
   {
      Print("Receive timeout or error");
      return "";
   }
   
   return CharArrayToString(recvBuf, 0, received, CP_UTF8);
}

//+------------------------------------------------------------------+
//| Shutdown ZeroMQ                                                  |
//+------------------------------------------------------------------+
void ShutdownZMQ()
{
   g_connected = false;
   
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
