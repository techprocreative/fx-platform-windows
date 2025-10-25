//+------------------------------------------------------------------+
//| ZMQ_Minimal_Test.mq5                                             |
//| Absolute minimal test - only version check                      |
//+------------------------------------------------------------------+
#property copyright "FX Platform"
#property version   "1.00"
#property strict

//--- Import ONLY zmq_version function
#import "libzmq.dll"
   void zmq_version(int &major[], int &minor[], int &patch[]);
#import

//+------------------------------------------------------------------+
//| Script program start function                                   |
//+------------------------------------------------------------------+
void OnStart()
{
   Print("=== MINIMAL ZMQ TEST - VERSION ONLY ===");
   
   int major[1], minor[1], patch[1];
   major[0] = 0;
   minor[0] = 0;
   patch[0] = 0;
   
   Print("Calling zmq_version...");
   
   zmq_version(major, minor, patch);
   
   Print("Result: ", major[0], ".", minor[0], ".", patch[0]);
   
   if(major[0] > 0) {
      Print("✅ SUCCESS! ZeroMQ version detected");
   } else {
      Print("❌ FAILED! Could not get version");
   }
}
//+------------------------------------------------------------------+
