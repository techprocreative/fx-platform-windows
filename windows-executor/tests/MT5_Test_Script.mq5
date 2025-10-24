//+------------------------------------------------------------------+ 
//| ZeroMQ DLL Compatibility Test                                   | 
//+------------------------------------------------------------------+
#property script_show_inputs

#import "libzmq.dll"
int  zmq_version(int &major,int &minor,int &patch);
int  zmq_ctx_new();
int  zmq_ctx_destroy(int context);
int  zmq_socket(int context,int type);
int  zmq_close(int socket);
int  zmq_bind(int socket,string endpoint);
int  zmq_connect(int socket,string endpoint);
int  zmq_send(int socket,string message,int length,int flags);
int  zmq_recv(int socket,string &message,int length,int flags);
#import

void OnStart()
{
   Print("=== libzmq.dll Verification ===");

   int major=0,minor=0,patch=0;
   zmq_version(major,minor,patch);
   PrintFormat("ZeroMQ Version: %d.%d.%d",major,minor,patch);

   int ctx=zmq_ctx_new();
   if(ctx==0)
   {
      Print("ERROR: zmq_ctx_new failed, DLL exports missing");
      return;
   }
   Print("Context created successfully");

   int socket=zmq_socket(ctx,3); // ZMQ_REQ
   if(socket==0)
   {
      Print("ERROR: zmq_socket failed");
      zmq_ctx_destroy(ctx);
      return;
   }
   Print("Socket created successfully");

   string endpoint="tcp://127.0.0.1:5555";
   if(zmq_connect(socket,endpoint)==0)
      PrintFormat("Connected to %s",endpoint);
   else
      Print("WARN: Unable to connect, ensure executor is running");

   string response="";
   if(zmq_send(socket,"PING",4,0)==0)
   {
      Print("PING sent successfully");
      if(zmq_recv(socket,response,1024,0)==0)
         Print("Received: ",response);
      else
         Print("WARN: No response received");
   }
   else
   {
      Print("WARN: Failed to send PING");
   }

   zmq_close(socket);
   zmq_ctx_destroy(ctx);
   Print("=== Verification Complete ===");
}
