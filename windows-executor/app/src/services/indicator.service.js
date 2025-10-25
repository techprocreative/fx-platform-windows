"use strict";
/**
 * Indicator Service
 * Calculates technical indicators from MT5 data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndicatorService = void 0;
const logger_1 = require("../utils/logger");
class IndicatorService {
    /**
     * Calculate Moving Average
     */
    calculateMA(bars, period, method = 'SMA') {
        if (bars.length < period) {
            return [];
        }
        const result = [];
        for (let i = period - 1; i < bars.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += bars[i - j].close;
            }
            result.push(sum / period);
        }
        return result;
    }
    /**
     * Calculate RSI
     */
    calculateRSI(bars, period = 14) {
        if (bars.length < period + 1) {
            return [];
        }
        const result = [];
        let gains = [];
        let losses = [];
        // Calculate price changes
        for (let i = 1; i < bars.length; i++) {
            const change = bars[i].close - bars[i - 1].close;
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        // Calculate RSI
        for (let i = period - 1; i < gains.length; i++) {
            let avgGain = 0;
            let avgLoss = 0;
            for (let j = 0; j < period; j++) {
                avgGain += gains[i - j];
                avgLoss += losses[i - j];
            }
            avgGain /= period;
            avgLoss /= period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            result.push(rsi);
        }
        return result;
    }
    /**
     * Calculate MACD
     */
    calculateMACD(bars, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(bars, fastPeriod);
        const slowEMA = this.calculateEMA(bars, slowPeriod);
        const macd = [];
        const minLength = Math.min(fastEMA.length, slowEMA.length);
        for (let i = 0; i < minLength; i++) {
            macd.push(fastEMA[i] - slowEMA[i]);
        }
        const signal = this.calculateEMAFromValues(macd, signalPeriod);
        const histogram = [];
        const minLen = Math.min(macd.length, signal.length);
        for (let i = 0; i < minLen; i++) {
            histogram.push(macd[i] - signal[i]);
        }
        return { macd, signal, histogram };
    }
    /**
     * Calculate EMA
     */
    calculateEMA(bars, period) {
        if (bars.length < period) {
            return [];
        }
        const result = [];
        const multiplier = 2 / (period + 1);
        // First EMA is SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += bars[i].close;
        }
        const firstEMA = sum / period;
        result.push(firstEMA);
        // Calculate subsequent EMAs
        for (let i = period; i < bars.length; i++) {
            const ema = (bars[i].close - result[result.length - 1]) * multiplier + result[result.length - 1];
            result.push(ema);
        }
        return result;
    }
    /**
     * Calculate EMA from values array
     */
    calculateEMAFromValues(values, period) {
        if (values.length < period) {
            return [];
        }
        const result = [];
        const multiplier = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += values[i];
        }
        const firstEMA = sum / period;
        result.push(firstEMA);
        for (let i = period; i < values.length; i++) {
            const ema = (values[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
            result.push(ema);
        }
        return result;
    }
    /**
     * Calculate ATR
     */
    calculateATR(bars, period = 14) {
        if (bars.length < period + 1) {
            return [];
        }
        const trueRanges = [];
        for (let i = 1; i < bars.length; i++) {
            const high = bars[i].high;
            const low = bars[i].low;
            const prevClose = bars[i - 1].close;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            trueRanges.push(tr);
        }
        return this.calculateEMAFromValues(trueRanges, period);
    }
    /**
     * Calculate Bollinger Bands
     */
    calculateBollingerBands(bars, period = 20, deviation = 2) {
        if (bars.length < period) {
            return { upper: [], middle: [], lower: [] };
        }
        const middle = [];
        const upper = [];
        const lower = [];
        for (let i = period - 1; i < bars.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += bars[i - j].close;
            }
            const sma = sum / period;
            let variance = 0;
            for (let j = 0; j < period; j++) {
                variance += Math.pow(bars[i - j].close - sma, 2);
            }
            const stdDev = Math.sqrt(variance / period);
            middle.push(sma);
            upper.push(sma + (deviation * stdDev));
            lower.push(sma - (deviation * stdDev));
        }
        return { upper, middle, lower };
    }
    /**
     * Calculate Stochastic Oscillator
     */
    calculateStochastic(bars, kPeriod = 14, dPeriod = 3, slowing = 3) {
        if (bars.length < kPeriod + slowing) {
            return { k: [], d: [] };
        }
        const kValues = [];
        for (let i = kPeriod - 1; i < bars.length; i++) {
            let highest = bars[i].high;
            let lowest = bars[i].low;
            for (let j = 0; j < kPeriod; j++) {
                if (bars[i - j].high > highest)
                    highest = bars[i - j].high;
                if (bars[i - j].low < lowest)
                    lowest = bars[i - j].low;
            }
            const currentClose = bars[i].close;
            const k = ((currentClose - lowest) / (highest - lowest)) * 100;
            kValues.push(k);
        }
        const kSmoothed = this.calculateSMA(kValues, slowing);
        const d = this.calculateSMA(kSmoothed, dPeriod);
        return { k: kSmoothed, d };
    }
    /**
     * Calculate SMA from values
     */
    calculateSMA(values, period) {
        if (values.length < period) {
            return [];
        }
        const result = [];
        for (let i = period - 1; i < values.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += values[i - j];
            }
            result.push(sum / period);
        }
        return result;
    }
    /**
     * Calculate ADX (Average Directional Index)
     */
    calculateADX(bars, period = 14) {
        if (bars.length < period + 1) {
            return { adx: [], plusDI: [], minusDI: [] };
        }
        const plusDM = [];
        const minusDM = [];
        const tr = [];
        for (let i = 1; i < bars.length; i++) {
            const highDiff = bars[i].high - bars[i - 1].high;
            const lowDiff = bars[i - 1].low - bars[i].low;
            plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
            minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
            const high = bars[i].high;
            const low = bars[i].low;
            const prevClose = bars[i - 1].close;
            tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
        }
        const smoothedPlusDM = this.calculateEMAFromValues(plusDM, period);
        const smoothedMinusDM = this.calculateEMAFromValues(minusDM, period);
        const smoothedTR = this.calculateEMAFromValues(tr, period);
        const plusDI = [];
        const minusDI = [];
        const dx = [];
        for (let i = 0; i < smoothedTR.length; i++) {
            const pdi = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
            const mdi = (smoothedMinusDM[i] / smoothedTR[i]) * 100;
            plusDI.push(pdi);
            minusDI.push(mdi);
            const dxValue = Math.abs(pdi - mdi) / (pdi + mdi) * 100;
            dx.push(dxValue);
        }
        const adx = this.calculateEMAFromValues(dx, period);
        return { adx, plusDI, minusDI };
    }
    /**
     * Calculate CCI (Commodity Channel Index)
     */
    calculateCCI(bars, period = 20) {
        if (bars.length < period) {
            return [];
        }
        const result = [];
        const constant = 0.015;
        for (let i = period - 1; i < bars.length; i++) {
            const typicalPrices = [];
            let sum = 0;
            for (let j = 0; j < period; j++) {
                const tp = (bars[i - j].high + bars[i - j].low + bars[i - j].close) / 3;
                typicalPrices.push(tp);
                sum += tp;
            }
            const sma = sum / period;
            let meanDeviation = 0;
            for (const tp of typicalPrices) {
                meanDeviation += Math.abs(tp - sma);
            }
            meanDeviation /= period;
            const currentTP = (bars[i].high + bars[i].low + bars[i].close) / 3;
            const cci = (currentTP - sma) / (constant * meanDeviation);
            result.push(cci);
        }
        return result;
    }
    /**
     * Calculate Williams %R
     */
    calculateWilliamsR(bars, period = 14) {
        if (bars.length < period) {
            return [];
        }
        const result = [];
        for (let i = period - 1; i < bars.length; i++) {
            let highest = bars[i].high;
            let lowest = bars[i].low;
            for (let j = 0; j < period; j++) {
                if (bars[i - j].high > highest)
                    highest = bars[i - j].high;
                if (bars[i - j].low < lowest)
                    lowest = bars[i - j].low;
            }
            const currentClose = bars[i].close;
            const williamsR = ((highest - currentClose) / (highest - lowest)) * -100;
            result.push(williamsR);
        }
        return result;
    }
    /**
     * Calculate VWAP (Volume Weighted Average Price)
     */
    calculateVWAP(bars) {
        if (bars.length === 0) {
            return [];
        }
        const result = [];
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;
        for (const bar of bars) {
            const typicalPrice = (bar.high + bar.low + bar.close) / 3;
            cumulativeTPV += typicalPrice * bar.volume;
            cumulativeVolume += bar.volume;
            const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
            result.push(vwap);
        }
        return result;
    }
    /**
     * Calculate Ichimoku Cloud
     */
    calculateIchimoku(bars, tenkanPeriod = 9, kijunPeriod = 26, senkouSpanBPeriod = 52) {
        const tenkanSen = [];
        const kijunSen = [];
        const senkouSpanA = [];
        const senkouSpanB = [];
        const chikouSpan = [];
        const calculateMidpoint = (bars, start, period) => {
            let highest = bars[start].high;
            let lowest = bars[start].low;
            for (let i = 0; i < period && (start - i) >= 0; i++) {
                if (bars[start - i].high > highest)
                    highest = bars[start - i].high;
                if (bars[start - i].low < lowest)
                    lowest = bars[start - i].low;
            }
            return (highest + lowest) / 2;
        };
        for (let i = 0; i < bars.length; i++) {
            if (i >= tenkanPeriod - 1) {
                tenkanSen.push(calculateMidpoint(bars, i, tenkanPeriod));
            }
            if (i >= kijunPeriod - 1) {
                kijunSen.push(calculateMidpoint(bars, i, kijunPeriod));
            }
            if (i >= kijunPeriod - 1 && tenkanSen.length > 0) {
                const spanA = (tenkanSen[tenkanSen.length - 1] + kijunSen[kijunSen.length - 1]) / 2;
                senkouSpanA.push(spanA);
            }
            if (i >= senkouSpanBPeriod - 1) {
                senkouSpanB.push(calculateMidpoint(bars, i, senkouSpanBPeriod));
            }
            chikouSpan.push(bars[i].close);
        }
        return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan };
    }
    /**
     * Calculate OBV (On Balance Volume)
     */
    calculateOBV(bars) {
        if (bars.length < 2) {
            return [];
        }
        const result = [];
        let obv = 0;
        result.push(obv);
        for (let i = 1; i < bars.length; i++) {
            if (bars[i].close > bars[i - 1].close) {
                obv += bars[i].volume;
            }
            else if (bars[i].close < bars[i - 1].close) {
                obv -= bars[i].volume;
            }
            result.push(obv);
        }
        return result;
    }
    /**
     * Calculate Volume MA
     */
    calculateVolumeMA(bars, period = 20) {
        if (bars.length < period) {
            return [];
        }
        const result = [];
        for (let i = period - 1; i < bars.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += bars[i - j].volume;
            }
            result.push(sum / period);
        }
        return result;
    }
    /**
     * Get indicator value
     */
    async getIndicatorValue(marketData, indicatorType, params) {
        try {
            switch (indicatorType) {
                case 'MA':
                case 'EMA':
                    const ma = this.calculateMA(marketData.bars, params.period || 20);
                    return ma.length > 0 ? ma[ma.length - 1] : null;
                case 'RSI':
                    const rsi = this.calculateRSI(marketData.bars, params.period || 14);
                    return rsi.length > 0 ? rsi[rsi.length - 1] : null;
                case 'MACD':
                    const macd = this.calculateMACD(marketData.bars, params.fastPeriod || 12, params.slowPeriod || 26, params.signalPeriod || 9);
                    return macd.macd.length > 0 ? macd.macd[macd.macd.length - 1] : null;
                case 'ATR':
                    const atr = this.calculateATR(marketData.bars, params.period || 14);
                    return atr.length > 0 ? atr[atr.length - 1] : null;
                case 'BB': {
                    const bb = this.calculateBollingerBands(marketData.bars, params.period || 20, params.deviation || 2);
                    return bb.middle.length > 0 ? bb.middle[bb.middle.length - 1] : null;
                }
                case 'STOCH': {
                    const stoch = this.calculateStochastic(marketData.bars, params.kPeriod || 14, params.dPeriod || 3, params.slowing || 3);
                    return stoch.k.length > 0 ? stoch.k[stoch.k.length - 1] : null;
                }
                case 'ADX': {
                    const adx = this.calculateADX(marketData.bars, params.period || 14);
                    return adx.adx.length > 0 ? adx.adx[adx.adx.length - 1] : null;
                }
                case 'CCI':
                    const cci = this.calculateCCI(marketData.bars, params.period || 20);
                    return cci.length > 0 ? cci[cci.length - 1] : null;
                case 'WILLIAMS':
                    const williams = this.calculateWilliamsR(marketData.bars, params.period || 14);
                    return williams.length > 0 ? williams[williams.length - 1] : null;
                case 'VWAP':
                    const vwap = this.calculateVWAP(marketData.bars);
                    return vwap.length > 0 ? vwap[vwap.length - 1] : null;
                case 'ICHIMOKU': {
                    const ichimoku = this.calculateIchimoku(marketData.bars, params.tenkanPeriod || 9, params.kijunPeriod || 26, params.senkouSpanBPeriod || 52);
                    return ichimoku.tenkanSen.length > 0 ? ichimoku.tenkanSen[ichimoku.tenkanSen.length - 1] : null;
                }
                case 'VOLUME': {
                    const obvData = this.calculateOBV(marketData.bars);
                    return obvData.length > 0 ? obvData[obvData.length - 1] : null;
                }
                default:
                    logger_1.logger.warn(`[IndicatorService] Unsupported indicator: ${indicatorType}`);
                    return null;
            }
        }
        catch (error) {
            logger_1.logger.error(`[IndicatorService] Error calculating ${indicatorType}:`, error);
            return null;
        }
    }
    /**
     * Detect price pattern
     */
    detectPattern(bars, pattern) {
        // TODO: Implement pattern detection
        // - Candlestick patterns (Doji, Hammer, Engulfing, etc)
        // - Chart patterns (Head & Shoulders, Double Top, etc)
        // - Trend patterns
        return false;
    }
}
exports.IndicatorService = IndicatorService;
