"use strict";
/**
 * Symbol Mapper Utility
 * Maps strategy symbols to MT5 broker symbols
 * Handles differences between platform symbols and broker symbols
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolMapper = void 0;
class SymbolMapper {
    /**
     * Map platform symbol to MT5 broker symbol
     */
    static toMT5Symbol(platformSymbol) {
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
    static toPlatformSymbol(mt5Symbol) {
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
    static addMapping(platformSymbol, mt5Symbol) {
        this.mappings[platformSymbol] = mt5Symbol;
    }
    /**
     * Get all mappings
     */
    static getMappings() {
        return { ...this.mappings };
    }
    /**
     * Check if symbol needs mapping
     */
    static needsMapping(platformSymbol) {
        return platformSymbol in this.mappings &&
            this.mappings[platformSymbol] !== platformSymbol;
    }
}
exports.SymbolMapper = SymbolMapper;
SymbolMapper.mappings = {
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
    'XAUUSD': 'XAUUSD', // Gold
    'XAGUSD': 'XAGUSD', // Silver
    'USOIL': 'USOIL', // WTI Oil
    'UKOIL': 'UKOIL', // Brent Oil
};
