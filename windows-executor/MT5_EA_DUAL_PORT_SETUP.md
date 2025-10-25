# MT5 EA Dual-Port Configuration Guide

## Architecture Overview

The FX Platform now uses a **dual-port architecture** for bi-directional communication:

### Port Configuration
- **Port 5555**: Windows Executor Server (Reply socket) - Receives data from MT5
- **Port 5556**: MT5 EA Server (Reply socket) - Receives requests from Windows Executor

### Communication Flow
```
Windows Executor                    MT5 EA
================                    ======
Server (5555) ← ─────────────────── Client Request Socket
   Reply Socket                      Sends: Market data, Account info
                                    
Client Request ─────────────────── → Server (5556)  
   Socket                            Reply Socket
   Sends: Commands                   Responds: Trade results
```

## Required MT5 EA Changes

### 1. Add Second ZeroMQ Socket

The EA needs to run **two ZeroMQ connections**:

```mql5
// Global variables
int zmqContextPush = NULL;     // For sending data to Executor (port 5555)
int zmqSocketPush = NULL;      // Request socket - connects to Executor

int zmqContextReply = NULL;    // For receiving commands from Executor (port 5556)
int zmqSocketReply = NULL;     // Reply socket - binds to port 5556

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Initialize ZeroMQ context for sending data
   zmqContextPush = zmq_ctx_new();
   if(zmqContextPush == NULL)
   {
      Print("Failed to create ZMQ context for push");
      return(INIT_FAILED);
   }
   
   // Create Request socket for sending to Executor
   zmqSocketPush = zmq_socket(zmqContextPush, ZMQ_REQ);
   if(zmqSocketPush == NULL)
   {
      Print("Failed to create ZMQ push socket");
      return(INIT_FAILED);
   }
   
   // Connect to Windows Executor server on port 5555
   string pushAddress = "tcp://localhost:5555";
   if(zmq_connect(zmqSocketPush, pushAddress) != 0)
   {
      Print("Failed to connect to Executor on port 5555");
      return(INIT_FAILED);
   }
   Print("Connected to Windows Executor on port 5555");
   
   // Initialize ZeroMQ context for receiving commands
   zmqContextReply = zmq_ctx_new();
   if(zmqContextReply == NULL)
   {
      Print("Failed to create ZMQ context for reply");
      return(INIT_FAILED);
   }
   
   // Create Reply socket for receiving from Executor
   zmqSocketReply = zmq_socket(zmqContextReply, ZMQ_REP);
   if(zmqSocketReply == NULL)
   {
      Print("Failed to create ZMQ reply socket");
      return(INIT_FAILED);
   }
   
   // Bind to port 5556 to receive commands
   string replyAddress = "tcp://127.0.0.1:5556";
   if(zmq_bind(zmqSocketReply, replyAddress) != 0)
   {
      Print("Failed to bind to port 5556");
      return(INIT_FAILED);
   }
   Print("Listening for commands on port 5556");
   
   return(INIT_SUCCEEDED);
}
```

### 2. Send Market Data to Executor (Port 5555)

```mql5
//+------------------------------------------------------------------+
//| Send market data to Windows Executor                            |
//+------------------------------------------------------------------+
void SendMarketData()
{
   // Prepare market data JSON
   string json = "{";
   json += "\"action\":\"market_data\",";
   json += "\"data\":{";
   json += "\"symbol\":\"" + Symbol() + "\",";
   json += "\"bid\":" + DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_BID), 5) + ",";
   json += "\"ask\":" + DoubleToString(SymbolInfoDouble(Symbol(), SYMBOL_ASK), 5) + ",";
   json += "\"time\":" + IntegerToString(TimeCurrent());
   json += "}}";
   
   // Send to Executor via Request socket
   if(zmq_send(zmqSocketPush, json, StringLen(json), 0) != -1)
   {
      // Wait for reply from Executor
      char buffer[1024];
      int recv_size = zmq_recv(zmqSocketPush, buffer, 1024, 0);
      if(recv_size > 0)
      {
         string response = CharArrayToString(buffer, 0, recv_size);
         Print("Executor response: ", response);
      }
   }
}
```

### 3. Handle Commands from Executor (Port 5556)

```mql5
//+------------------------------------------------------------------+
//| Check for commands from Windows Executor                        |
//+------------------------------------------------------------------+
void CheckForCommands()
{
   char buffer[4096];
   
   // Non-blocking receive (ZMQ_DONTWAIT flag)
   int recv_size = zmq_recv(zmqSocketReply, buffer, 4096, ZMQ_DONTWAIT);
   
   if(recv_size > 0)
   {
      string request = CharArrayToString(buffer, 0, recv_size);
      Print("Received command from Executor: ", request);
      
      // Parse and handle command
      string response = ProcessCommand(request);
      
      // Send response back
      zmq_send(zmqSocketReply, response, StringLen(response), 0);
   }
}

//+------------------------------------------------------------------+
//| Process command from Executor                                    |
//+------------------------------------------------------------------+
string ProcessCommand(string request)
{
   // Parse JSON request and handle commands
   // Example: OPEN_POSITION, CLOSE_POSITION, GET_BARS, etc.
   
   if(StringFind(request, "\"command\":\"GET_BARS\"") >= 0)
   {
      return GetHistoricalBars(request);
   }
   else if(StringFind(request, "\"command\":\"OPEN_POSITION\"") >= 0)
   {
      return ExecuteTrade(request);
   }
   // ... other commands
   
   return "{\"status\":\"ERROR\",\"error\":\"Unknown command\"}";
}
```

### 4. Main Loop Integration

```mql5
//+------------------------------------------------------------------+
//| Expert tick function                                            |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check for commands from Executor (non-blocking)
   CheckForCommands();
   
   // Send market data periodically (every second)
   static datetime lastDataSend = 0;
   if(TimeCurrent() - lastDataSend >= 1)
   {
      SendMarketData();
      SendAccountInfo();
      lastDataSend = TimeCurrent();
   }
   
   // Your existing EA logic here...
}
```

### 5. Clean Up on Deinit

```mql5
//+------------------------------------------------------------------+
//| Expert deinitialization function                                |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   // Close push socket
   if(zmqSocketPush != NULL)
   {
      zmq_close(zmqSocketPush);
      zmqSocketPush = NULL;
   }
   
   if(zmqContextPush != NULL)
   {
      zmq_ctx_destroy(zmqContextPush);
      zmqContextPush = NULL;
   }
   
   // Close reply socket  
   if(zmqSocketReply != NULL)
   {
      zmq_close(zmqSocketReply);
      zmqSocketReply = NULL;
   }
   
   if(zmqContextReply != NULL)
   {
      zmq_ctx_destroy(zmqContextReply);
      zmqContextReply = NULL;
   }
   
   Print("ZeroMQ connections closed");
}
```

## Testing the Connection

### 1. Compile and Attach EA
- Compile the EA with the dual-port changes
- Attach to a chart in MT5

### 2. Check MT5 Expert Tab
You should see:
```
Connected to Windows Executor on port 5555
Listening for commands on port 5556
```

### 3. Check Windows Executor Logs
You should see:
```
✅ ZeroMQ Server listening on tcp://127.0.0.1:5555
✅ ZeroMQ Client connected on port 5556 - ready to send requests to MT5
```

### 4. Monitor Data Flow
- EA should send market data every second to port 5555
- Executor can send commands to port 5556
- Both directions should work independently

## Troubleshooting

### Port Already in Use
If you get "Address already in use" error:
1. Check if another process is using the ports:
   ```cmd
   netstat -an | findstr 5555
   netstat -an | findstr 5556
   ```
2. Restart MT5 and Windows Executor

### Connection Refused
1. Check Windows Firewall - allow ports 5555 and 5556
2. Ensure both applications are running
3. Verify EA is attached to a chart

### No Data Flow
1. Check EA Expert tab for errors
2. Check Windows Executor console for connection logs
3. Ensure ZeroMQ DLL files are in MT5 Libraries folder

## Benefits of Dual-Port Architecture

1. **True Bi-directional Communication**: Data flows both ways independently
2. **No Port Conflicts**: Each service has its dedicated port
3. **Better Performance**: No blocking between send and receive operations
4. **Scalability**: Can handle high-frequency data updates and commands
5. **Reliability**: If one direction fails, the other can still work

## Next Steps

1. Update the MT5 EA with the dual-port configuration
2. Test the connection with simple ping-pong messages
3. Implement market data streaming from EA to Executor
4. Test command execution from Executor to EA
5. Monitor performance and adjust buffer sizes if needed
