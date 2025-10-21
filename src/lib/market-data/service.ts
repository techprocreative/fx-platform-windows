import { MarketDataProvider, MarketQuote, HistoricalData, SymbolInfo, DataProviderException } from '../data-providers/common/types';
import { TwelveDataProvider } from '../data-providers/twelve-data/provider';
import { YahooFinanceProvider } from '../data-providers/yahoo-finance/provider';

export interface MarketDataConfig {
  twelveDataApiKey?: string;
  yahooFinanceApiKey?: string;
  yahooFinanceApiHost?: string;
  preferredProvider?: 'twelvedata' | 'yahoo-finance';
  enableFallback?: boolean;
}

export class MarketDataService {
  private providers: Map<string, MarketDataProvider> = new Map();
  private preferredProvider: string = 'twelvedata';
  private enableFallback: boolean = true;

  constructor(config: MarketDataConfig) {
    this.configureProviders(config);
  }

  private configureProviders(config: MarketDataConfig): void {
    // Initialize TwelveData provider
    if (config.twelveDataApiKey) {
      const twelveData = new TwelveDataProvider(config.twelveDataApiKey);
      this.providers.set('twelvedata', twelveData);
    }

    // Initialize Yahoo Finance provider
    if (config.yahooFinanceApiKey && config.yahooFinanceApiHost) {
      const yahooFinance = new YahooFinanceProvider(
        config.yahooFinanceApiKey,
        config.yahooFinanceApiHost
      );
      this.providers.set('yahoo-finance', yahooFinance);
    }

    // Set preferences
    if (config.preferredProvider && this.providers.has(config.preferredProvider)) {
      this.preferredProvider = config.preferredProvider;
    }

    this.enableFallback = config.enableFallback ?? true;

    if (this.providers.size === 0) {
      throw new Error('No market data providers configured');
    }
  }

  async getRealTimeQuote(symbols: string[]): Promise<MarketQuote[]> {
    return this.executeWithFallback(
      async (provider) => provider.getRealTimeQuote(symbols),
      'getRealTimeQuote',
      { symbols }
    );
  }

  async getHistoricalData(symbol: string, timeframe: string, limit?: number): Promise<HistoricalData> {
    return this.executeWithFallback(
      async (provider) => provider.getHistoricalData(symbol, timeframe, limit),
      'getHistoricalData',
      { symbol, timeframe, limit }
    );
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    return this.executeWithFallback(
      async (provider) => provider.getSymbolInfo(symbol),
      'getSymbolInfo',
      { symbol }
    );
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    return this.executeWithFallback(
      async (provider) => provider.searchSymbols(query),
      'searchSymbols',
      { query }
    );
  }

  private async executeWithFallback<T>(
    operation: (provider: MarketDataProvider) => Promise<T>,
    operationName: string,
    params: any
  ): Promise<T> {
    const providerOrder = this.getProviderOrder();
    const errors: Array<{ provider: string; error: DataProviderException }> = [];

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        console.log(`Attempting ${operationName} with provider: ${providerName}`, params);
        const result = await operation(provider);
        console.log(`Success with provider: ${providerName}`);
        return result;
      } catch (error) {
        console.error(`Failed ${operationName} with provider ${providerName}:`, error);
        errors.push({ provider: providerName, error: error as DataProviderException });

        if (!this.enableFallback) {
          break;
        }
      }
    }

    // All providers failed
    const errorSummary = errors.map(e => `${e.provider}: ${e.error.message}`).join('; ');
    throw new DataProviderException(
      `All providers failed for ${operationName}. Errors: ${errorSummary}`,
      'ALL_PROVIDERS_FAILED',
      'market-data-service',
      { operation: operationName, params, errors }
    );
  }

  private getProviderOrder(): string[] {
    const order = [this.preferredProvider];

    // Add other providers as fallbacks
    for (const providerName of this.providers.keys()) {
      if (providerName !== this.preferredProvider) {
        order.push(providerName);
      }
    }

    return order;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderStatus(): { [provider: string]: 'available' | 'unavailable' } {
    const status: { [provider: string]: 'available' | 'unavailable' } = {};

    for (const [name, provider] of this.providers) {
      status[name] = 'available'; // Could implement health checks here
    }

    return status;
  }

  async testProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) return false;

    try {
      // Test with a simple quote request for EURUSD
      await provider.getRealTimeQuote(['EURUSD']);
      return true;
    } catch (error) {
      console.error(`Provider ${providerName} test failed:`, error);
      return false;
    }
  }

  async testAllProviders(): Promise<{ [provider: string]: boolean }> {
    const results: { [provider: string]: boolean } = {};

    for (const providerName of this.providers.keys()) {
      results[providerName] = await this.testProvider(providerName);
    }

    return results;
  }
}

// Singleton instance for the application
let marketDataService: MarketDataService | null = null;

export function initializeMarketDataService(config: MarketDataConfig): MarketDataService {
  if (marketDataService) {
    console.warn('Market data service already initialized');
    return marketDataService;
  }

  marketDataService = new MarketDataService(config);
  return marketDataService;
}

export function getMarketDataService(): MarketDataService {
  if (!marketDataService) {
    throw new Error('Market data service not initialized. Call initializeMarketDataService first.');
  }

  return marketDataService;
}

// Default configuration
export const DEFAULT_MARKET_DATA_CONFIG: MarketDataConfig = {
  twelveDataApiKey: process.env.TWELVEDATA_API_KEY,
  yahooFinanceApiKey: process.env.YAHOO_FINANCE_API_KEY,
  yahooFinanceApiHost: process.env.YAHOO_FINANCE_RAPIDAPI_HOST,
  preferredProvider: 'twelvedata',
  enableFallback: true
};
