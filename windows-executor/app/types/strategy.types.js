"use strict";
/**
 * Strategy Types & Interfaces
 * Defines structure for trading strategies from web platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketRegime = void 0;
// ============================================================================
// REGIME DETECTION
// ============================================================================
var MarketRegime;
(function (MarketRegime) {
    MarketRegime["BULLISH_TRENDING"] = "bullish_trending";
    MarketRegime["BEARISH_TRENDING"] = "bearish_trending";
    MarketRegime["RANGING"] = "ranging";
    MarketRegime["HIGH_VOLATILITY"] = "high_volatility";
    MarketRegime["LOW_VOLATILITY"] = "low_volatility";
    MarketRegime["BREAKOUT"] = "breakout";
})(MarketRegime || (exports.MarketRegime = MarketRegime = {}));
