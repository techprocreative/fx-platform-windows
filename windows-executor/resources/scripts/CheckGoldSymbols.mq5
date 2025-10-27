//+------------------------------------------------------------------+
//| Script: CheckGoldSymbols.mq5                                     |
//| Purpose: Find correct GOLD symbol name in your broker            |
//+------------------------------------------------------------------+
#property copyright "NusaNexus Trading Systems"
#property version   "1.0"
#property script_show_inputs

void OnStart()
{
   Print("========================================");
   Print(" Checking for GOLD/XAU symbols...");
   Print("========================================");
   
   int total = SymbolsTotal(true);  // Selected symbols in Market Watch
   int found = 0;
   
   Print("Total symbols in Market Watch: ", total);
   Print("");
   
   // Check selected symbols
   Print("--- Searching in Market Watch ---");
   for(int i = 0; i < total; i++)
   {
      string symbol = SymbolName(i, true);
      
      // Check if symbol contains GOLD or XAU
      if(StringFind(symbol, "GOLD") >= 0 || StringFind(symbol, "XAU") >= 0)
      {
         found++;
         Print(found, ". Symbol: ", symbol);
         Print("   Description: ", SymbolInfoString(symbol, SYMBOL_DESCRIPTION));
         Print("   Currency Base: ", SymbolInfoString(symbol, SYMBOL_CURRENCY_BASE));
         Print("   Currency Profit: ", SymbolInfoString(symbol, SYMBOL_CURRENCY_PROFIT));
         Print("   Digits: ", (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS));
         Print("   Spread: ", (int)SymbolInfoInteger(symbol, SYMBOL_SPREAD), " points");
         Print("   Current Bid: ", SymbolInfoDouble(symbol, SYMBOL_BID));
         Print("   Current Ask: ", SymbolInfoDouble(symbol, SYMBOL_ASK));
         Print("");
      }
   }
   
   if(found == 0)
   {
      Print("⚠️ No GOLD/XAU symbols found in Market Watch!");
      Print("");
      Print("Searching ALL available symbols...");
      Print("");
      
      // Search all available symbols
      total = SymbolsTotal(false);  // All symbols
      Print("--- Searching in All Symbols (", total, " total) ---");
      
      for(int i = 0; i < total; i++)
      {
         string symbol = SymbolName(i, false);
         
         // Check if symbol contains GOLD or XAU
         if(StringFind(symbol, "GOLD") >= 0 || StringFind(symbol, "XAU") >= 0)
         {
            found++;
            Print(found, ". Symbol: ", symbol);
            Print("   Description: ", SymbolInfoString(symbol, SYMBOL_DESCRIPTION));
            Print("   Path: ", SymbolInfoString(symbol, SYMBOL_PATH));
            
            // Try to select it
            if(SymbolSelect(symbol, true))
            {
               Print("   ✅ Added to Market Watch");
            }
            else
            {
               Print("   ❌ Failed to add to Market Watch");
            }
            Print("");
            
            // Limit output
            if(found >= 10) 
            {
               Print("... (showing first 10 matches only)");
               break;
            }
         }
      }
   }
   
   Print("========================================");
   Print(" Summary");
   Print("========================================");
   Print("Total GOLD/XAU symbols found: ", found);
   
   if(found > 0)
   {
      Print("");
      Print("💡 Next Steps:");
      Print("1. Note the exact symbol name from above");
      Print("2. Update your strategy symbol to match");
      Print("3. Restart EA and test again");
   }
   else
   {
      Print("");
      Print("❌ No GOLD/XAU symbols found!");
      Print("");
      Print("Possible reasons:");
      Print("- Broker doesn't offer GOLD trading");
      Print("- Symbol name is different (e.g., GOLD.m, XAUUSD.)");
      Print("- Need to enable in Market Watch settings");
      Print("");
      Print("Contact your broker for correct symbol name.");
   }
   
   Print("========================================");
}
//+------------------------------------------------------------------+
