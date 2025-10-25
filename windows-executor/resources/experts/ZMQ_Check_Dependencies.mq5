//+------------------------------------------------------------------+
//| ZMQ_Check_Dependencies.mq5                                       |
//| Check if DLL can be loaded at all                               |
//+------------------------------------------------------------------+
#property copyright "FX Platform"
#property version   "1.00"
#property strict

//+------------------------------------------------------------------+
//| Script program start function                                   |
//+------------------------------------------------------------------+
void OnStart()
{
   Print("=== CHECKING DLL LOAD ===");
   
   // Try to load the DLL without calling any functions
   string dllPath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Libraries\\libzmq.dll";
   
   Print("DLL Path: ", dllPath);
   
   // Check if file exists
   if(!FileIsExist("libzmq.dll", FILE_COMMON)) {
      Print("❌ ERROR: libzmq.dll NOT FOUND in Libraries folder");
      Print("Expected at: ", dllPath);
      return;
   }
   
   Print("✅ DLL file exists");
   
   // Check Terminal settings
   if(!TerminalInfoInteger(TERMINAL_DLLS_ALLOWED)) {
      Print("❌ ERROR: DLL imports are NOT ALLOWED");
      Print("Go to: Tools → Options → Expert Advisors");
      Print("Enable: 'Allow DLL imports'");
      return;
   }
   
   Print("✅ DLL imports are ALLOWED");
   
   // Check if algorithmic trading is enabled
   if(!MQLInfoInteger(MQL_DLLS_ALLOWED)) {
      Print("❌ ERROR: DLLs not allowed for this EA");
      Print("When attaching EA, check: 'Allow DLL imports'");
      return;
   }
   
   Print("✅ EA has DLL permission");
   
   Print("\n=== ALL CHECKS PASSED ===");
   Print("DLL should be loadable");
   Print("\nNext: Try calling a simple function");
}
//+------------------------------------------------------------------+
