/**
 * Symbol Mapper Utility
 * Maps strategy symbols to MT5 broker symbols
 * Handles differences between platform symbols and broker symbols
 */

export class SymbolMapper {
  private static mappings: Record<string, string> = {
    // Crypto mappings (add 'm' suffix for your broker)
    'BTCUSD': 'BTCUSDm',
    'ETHUSD': 'ETHUSDm',
    'LTCUSD': 'LTCUSDm',
    'XRPUSD': 'XRPUSDm',
    
    // Forex mappings (usually unchanged)
    'EURUSD': 'EURUSD',
    'GBPUSD': 'GBPUSD',
    'USDJPY': 'USDJPY',
    'AUDUSD': 'AUDUSD',
    'USDCAD': 'USDCAD',
    'USDCHF': 'USDCHF',
    'NZDUSD': 'NZDUSD',
    
    // Indices (add suffix if needed)
    'US30': 'US30',
    'US100': 'US100',
    'US500': 'US500',
    'DE30': 'DE30',
    
    // Commodities
    'XAUUSD': 'XAUUSD',  // Gold
    'XAGUSD': 'XAGUSD',  // Silver
    'USOIL': 'USOIL',    // WTI Oil
    'UKOIL': 'UKOIL',    // Brent Oil
  };

  /**
   * Map platform symbol to MT5 broker symbol
   */
  static toMT5Symbol(platformSymbol: string): string {
    // Check if there's a specific mapping
    if (this.mappings[platformSymbol]) {
      return this.mappings[platformSymbol];
    }
    
    // If no mapping found, return original symbol
    // This allows for symbols that don't need mapping
    return platformSymbol;
  }

  /**
   * Map MT5 broker symbol back to platform symbol
   */
  static toPlatformSymbol(mt5Symbol: string): string {
    // Find reverse mapping
    for (const [platform, broker] of Object.entries(this.mappings)) {
      if (broker === mt5Symbol) {
        return platform;
      }
    }
    
    // If no reverse mapping found, try removing common suffixes
    // Remove 'm' suffix for crypto
    if (mt5Symbol.endsWith('m') && mt5Symbol.includes('USD')) {
      const withoutSuffix = mt5Symbol.slice(0, -1);
      // Check if this looks like a crypto pair
      if (withoutSuffix.match(/^[A-Z]{3,4}USD$/)) {
        return withoutSuffix;
      }
    }
    
    // Return original if no mapping found
    return mt5Symbol;
  }

  /**
   * Add custom mapping
   */
  static addMapping(platformSymbol: string, mt5Symbol: string): void {
    this.mappings[platformSymbol] = mt5Symbol;
  }

  /**
   * Get all mappings
   */
  static getMappings(): Record<string, string> {
    return { ...this.mappings };
  }

  /**
   * Check if symbol needs mapping
   */
  static needsMapping(platformSymbol: string): boolean {
    return platformSymbol in this.mappings && 
           this.mappings[platformSymbol] !== platformSymbol;
  }
}
