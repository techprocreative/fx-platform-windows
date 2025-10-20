/**
 * Trading Terms Glossary
 * 
 * This file contains comprehensive definitions for trading and financial terms
 * used throughout the FX Platform.
 */

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  context?: string;
  examples?: string[];
  relatedTerms?: string[];
  category: 'basic' | 'technical' | 'risk' | 'strategy' | 'analysis';
}

export const tradingGlossary: Record<string, GlossaryTerm> = {
  // Basic Terms
  pip: {
    id: 'pip',
    term: 'PIP',
    definition: 'Percentage in Point - The smallest price move that a given exchange rate can make based on market convention.',
    context: 'For most currency pairs, one pip is equal to 0.0001. For JPY pairs, it\'s 0.01.',
    examples: [
      'If EUR/USD moves from 1.1000 to 1.1001, that\'s a 1 pip movement.',
      'A 10 pip profit on EUR/USD means the price moved 0.0010 in your favor.'
    ],
    relatedTerms: ['pipette', 'spread', 'lot'],
    category: 'basic'
  },

  pipette: {
    id: 'pipette',
    term: 'Pipette',
    definition: 'A fractional pip, equal to 1/10 of a pip.',
    context: 'Also known as points or fractional pips, allowing for more precise pricing.',
    examples: [
      'If EUR/USD moves from 1.10000 to 1.10001, that\'s a 1 pipette movement.',
      '5 pipettes equal 0.5 pips.'
    ],
    relatedTerms: ['pip', 'spread'],
    category: 'basic'
  },

  lot: {
    id: 'lot',
    term: 'Lot',
    definition: 'A standardized quantity of a financial instrument used for trading.',
    context: 'Standard lots are 100,000 units of the base currency.',
    examples: [
      '1 standard lot of EUR/USD is €100,000.',
      'Mini lots (10,000) and micro lots (1,000) are also available.'
    ],
    relatedTerms: ['leverage', 'margin', 'position size'],
    category: 'basic'
  },

  leverage: {
    id: 'leverage',
    term: 'Leverage',
    definition: 'The use of borrowed funds to increase one\'s trading position beyond what would be available from their cash balance alone.',
    context: 'Expressed as a ratio (e.g., 100:1), higher leverage increases both potential profits and losses.',
    examples: [
      '100:1 leverage means you can control $100,000 with $1,000 of margin.',
      'High leverage amplifies both gains and losses significantly.'
    ],
    relatedTerms: ['margin', 'lot', 'risk management'],
    category: 'risk'
  },

  spread: {
    id: 'spread',
    term: 'Spread',
    definition: 'The difference between the bid (sell) and ask (buy) price of a financial instrument.',
    context: 'Tighter spreads typically indicate higher liquidity and lower trading costs.',
    examples: [
      'If EUR/USD bid is 1.1000 and ask is 1.1002, the spread is 2 pips.',
      'Spreads can be fixed or variable depending on market conditions.'
    ],
    relatedTerms: ['pip', 'bid', 'ask', 'liquidity'],
    category: 'basic'
  },

  bid: {
    id: 'bid',
    term: 'Bid Price',
    definition: 'The highest price a buyer is willing to pay for a financial instrument.',
    context: 'When you sell, you receive the bid price.',
    examples: [
      'If EUR/USD bid is 1.1000, you can sell at this price.',
      'The bid is always lower than the ask price.'
    ],
    relatedTerms: ['ask', 'spread', 'sell'],
    category: 'basic'
  },

  ask: {
    id: 'ask',
    term: 'Ask Price',
    definition: 'The lowest price a seller is willing to accept for a financial instrument.',
    context: 'Also called the offer price. When you buy, you pay the ask price.',
    examples: [
      'If EUR/USD ask is 1.1002, you can buy at this price.',
      'The ask is always higher than the bid price.'
    ],
    relatedTerms: ['bid', 'spread', 'buy'],
    category: 'basic'
  },

  margin: {
    id: 'margin',
    term: 'Margin',
    definition: 'The collateral that a trader must deposit with their broker to cover the credit risk the holder poses for the broker.',
    context: 'Required to open and maintain positions in the market.',
    examples: [
      'With 1% margin requirement, $1,000 controls $100,000 position.',
      'Margin calls occur when account equity falls below required margin.'
    ],
    relatedTerms: ['leverage', 'margin call', 'lot'],
    category: 'risk'
  },

  // Technical Analysis Terms
  support: {
    id: 'support',
    term: 'Support Level',
    definition: 'A price level where a downtrend is expected to pause due to a concentration of demand.',
    context: 'When prices reach support, buyers may become more active, preventing further decline.',
    examples: [
      'If EUR/USD has bounced off 1.1000 multiple times, 1.1000 is a support level.',
      'Broken support often becomes resistance.'
    ],
    relatedTerms: ['resistance', 'trend', 'technical analysis'],
    category: 'technical'
  },

  resistance: {
    id: 'resistance',
    term: 'Resistance Level',
    definition: 'A price level where an uptrend is expected to pause temporarily due to a concentration of supply.',
    context: 'When prices reach resistance, sellers may become more active, preventing further rise.',
    examples: [
      'If EUR/USD has failed to break above 1.2000 multiple times, it\'s resistance.',
      'Broken resistance often becomes support.'
    ],
    relatedTerms: ['support', 'trend', 'technical analysis'],
    category: 'technical'
  },

  trend: {
    id: 'trend',
    term: 'Trend',
    definition: 'The general direction in which a market or asset price is moving over time.',
    context: 'Can be upward (bullish), downward (bearish), or sideways (ranging).',
    examples: [
      'An uptrend is characterized by higher highs and higher lows.',
      'Trends can be short-term, medium-term, or long-term.'
    ],
    relatedTerms: ['support', 'resistance', 'technical analysis'],
    category: 'technical'
  },

  volatility: {
    id: 'volatility',
    term: 'Volatility',
    definition: 'A statistical measure of the dispersion of returns for a given security or market index.',
    context: 'High volatility indicates larger price swings and higher risk.',
    examples: [
      'EUR/USD is less volatile than exotic pairs like USD/TRY.',
      'Volatility often increases during major economic announcements.'
    ],
    relatedTerms: ['risk', 'standard deviation', 'ATR'],
    category: 'technical'
  },

  // Strategy Terms
  backtest: {
    id: 'backtest',
    term: 'Backtesting',
    definition: 'The process of testing a trading strategy on prior time periods to see how it would have performed historically.',
    context: 'Essential for strategy validation before risking real capital.',
    examples: [
      'Backtesting a moving average strategy on 5 years of historical data.',
      'Past performance doesn\'t guarantee future results.'
    ],
    relatedTerms: ['strategy', 'optimization', 'paper trading'],
    category: 'strategy'
  },

  drawdown: {
    id: 'drawdown',
    term: 'Drawdown',
    definition: 'The peak-to-trough decline during a specific period of an investment, fund or commodity.',
    context: 'A key risk metric showing the largest loss from a peak to a trough.',
    examples: [
      'If your account grows from $10,000 to $15,000 then drops to $12,000, the drawdown is $3,000.',
      'Maximum drawdown is a crucial risk metric.'
    ],
    relatedTerms: ['risk management', 'peak', 'trough'],
    category: 'risk'
  },

  'win-rate': {
    id: 'win-rate',
    term: 'Win Rate',
    definition: 'The percentage of trades that are profitable out of the total number of trades executed.',
    context: 'Win rate alone doesn\'t determine profitability - risk/reward ratio is also crucial.',
    examples: [
      'A 60% win rate means 6 out of 10 trades are profitable.',
      'High win rate with small winners can still be unprofitable.'
    ],
    relatedTerms: ['profit factor', 'risk-reward ratio', 'expectancy'],
    category: 'strategy'
  },

  'risk-reward': {
    id: 'risk-reward',
    term: 'Risk/Reward Ratio',
    definition: 'The ratio of the potential profit of a trade to its potential loss.',
    context: 'Higher risk/reward ratios mean more profit potential relative to risk.',
    examples: [
      'A 1:2 risk/reward means risking $1 to potentially make $2.',
      'Professional traders often use 1:2 or higher ratios.'
    ],
    relatedTerms: ['win rate', 'position sizing', 'stop loss'],
    category: 'risk'
  },

  // Analysis Terms
  'fundamental-analysis': {
    id: 'fundamental-analysis',
    term: 'Fundamental Analysis',
    definition: 'A method of evaluating a security by attempting to measure its intrinsic value by examining related economic and financial factors.',
    context: 'In forex, this includes interest rates, GDP, inflation, and other economic indicators.',
    examples: [
      'Analyzing how interest rate decisions affect currency values.',
      'Economic calendar events are key for fundamental analysis.'
    ],
    relatedTerms: ['technical analysis', 'economic indicators', 'interest rates'],
    category: 'analysis'
  },

  'technical-analysis': {
    id: 'technical-analysis',
    term: 'Technical Analysis',
    definition: 'A method of evaluating securities by analyzing statistics generated by market activity, such as past prices and volume.',
    context: 'Based on the idea that market trends and patterns are predictable and repeatable.',
    examples: [
      'Using moving averages and support/resistance levels for trade decisions.',
      'Chart patterns like head and shoulders or double tops.'
    ],
    relatedTerms: ['fundamental analysis', 'indicators', 'chart patterns'],
    category: 'analysis'
  },

  indicators: {
    id: 'indicators',
    term: 'Technical Indicators',
    definition: 'Mathematical calculations based on historical price and volume data used to forecast future price movements.',
    context: 'Popular indicators include RSI, MACD, Moving Averages, and Bollinger Bands.',
    examples: [
      'RSI above 70 indicates overbought conditions.',
      'MACD crossover can signal trend changes.'
    ],
    relatedTerms: ['technical analysis', 'oscillators', 'trend indicators'],
    category: 'technical'
  }
};

/**
 * Get a glossary term by ID
 */
export function getGlossaryTerm(id: string): GlossaryTerm | null {
  return tradingGlossary[id.toLowerCase()] || null;
}

/**
 * Search for glossary terms
 */
export function searchGlossaryTerms(query: string): GlossaryTerm[] {
  const lowercaseQuery = query.toLowerCase();
  
  return Object.values(tradingGlossary).filter(term => 
    term.term.toLowerCase().includes(lowercaseQuery) ||
    term.definition.toLowerCase().includes(lowercaseQuery) ||
    term.context?.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Get glossary terms by category
 */
export function getGlossaryTermsByCategory(category: GlossaryTerm['category']): GlossaryTerm[] {
  return Object.values(tradingGlossary).filter(term => term.category === category);
}

/**
 * Get related terms for a given term ID
 */
export function getRelatedTerms(termId: string): GlossaryTerm[] {
  const term = getGlossaryTerm(termId);
  if (!term || !term.relatedTerms) {
    return [];
  }

  return term.relatedTerms
    .map(relatedId => getGlossaryTerm(relatedId))
    .filter((term): term is GlossaryTerm => term !== null);
}

/**
 * Get all categories
 */
export function getGlossaryCategories(): GlossaryTerm['category'][] {
  return ['basic', 'technical', 'risk', 'strategy', 'analysis'];
}