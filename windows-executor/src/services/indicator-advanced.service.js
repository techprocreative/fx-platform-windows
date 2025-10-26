/**
 * Advanced Indicator Service
 * Additional indicators for Phase 2 implementation
 * Implements: Bollinger Bands, Stochastic, ADX, CCI, Williams %R, etc.
 */
import { logger } from '../utils/logger';
export class AdvancedIndicatorService {
    /**
     * Calculate Bollinger Bands
     * Measures market volatility
     */
    calculateBollingerBands(data, period = 20, stdDev = 2) {
        logger.debug(`[AdvancedIndicator] Calculating Bollinger Bands (period: ${period}, stdDev: ${stdDev})`);
        const closes = data.map(d => d.close);
        const middle = this.calculateSMA(closes, period);
        const upper = [];
        const lower = [];
        const bandwidth = [];
        for (let i = 0; i < closes.length; i++) {
            if (i < period - 1) {
                upper.push(NaN);
                lower.push(NaN);
                bandwidth.push(NaN);
                continue;
            }
            const slice = closes.slice(i - period + 1, i + 1);
            const mean = middle[i];
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
            const std = Math.sqrt(variance);
            upper.push(mean + (stdDev * std));
            lower.push(mean - (stdDev * std));
            bandwidth.push((upper[i] - lower[i]) / mean * 100);
        }
        return { upper, middle, lower, bandwidth };
    }
    /**
     * Calculate Stochastic Oscillator
     * Momentum indicator comparing closing price to price range
     */
    calculateStochastic(data, kPeriod = 14, dPeriod = 3, smooth = 3) {
        logger.debug(`[AdvancedIndicator] Calculating Stochastic (K: ${kPeriod}, D: ${dPeriod})`);
        const k = [];
        const d = [];
        const signal = [];
        // Calculate raw %K
        for (let i = 0; i < data.length; i++) {
            if (i < kPeriod - 1) {
                k.push(NaN);
                continue;
            }
            const slice = data.slice(i - kPeriod + 1, i + 1);
            const highestHigh = Math.max(...slice.map(d => d.high));
            const lowestLow = Math.min(...slice.map(d => d.low));
            const close = data[i].close;
            const rawK = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
            k.push(rawK);
        }
        // Smooth %K
        const smoothK = this.calculateSMA(k.filter(v => !isNaN(v)), smooth);
        // Calculate %D (SMA of %K)
        const kForD = k.map((v, i) => i < k.length - smoothK.length + k.filter(v => !isNaN(v)).length ? NaN : smoothK[i - (k.length - smoothK.length)]);
        const dValues = this.calculateSMA(kForD.filter(v => !isNaN(v)), dPeriod);
        // Pad D values
        for (let i = 0; i < data.length; i++) {
            const dIndex = i - (data.length - dValues.length);
            d.push(dIndex >= 0 ? dValues[dIndex] : NaN);
        }
        // Generate signals
        for (let i = 0; i < data.length; i++) {
            if (isNaN(k[i]) || isNaN(d[i])) {
                signal.push('neutral');
            }
            else if (k[i] > 80 && d[i] > 80) {
                signal.push('overbought');
            }
            else if (k[i] < 20 && d[i] < 20) {
                signal.push('oversold');
            }
            else {
                signal.push('neutral');
            }
        }
        return { k, d, signal };
    }
    /**
     * Calculate ADX (Average Directional Index)
     * Measures trend strength
     */
    calculateADX(data, period = 14) {
        logger.debug(`[AdvancedIndicator] Calculating ADX (period: ${period})`);
        const plusDM = [];
        const minusDM = [];
        const tr = [];
        // Calculate +DM, -DM, and TR
        for (let i = 1; i < data.length; i++) {
            const highDiff = data[i].high - data[i - 1].high;
            const lowDiff = data[i - 1].low - data[i].low;
            plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
            minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
            const tr1 = data[i].high - data[i].low;
            const tr2 = Math.abs(data[i].high - data[i - 1].close);
            const tr3 = Math.abs(data[i].low - data[i - 1].close);
            tr.push(Math.max(tr1, tr2, tr3));
        }
        // Smooth with Wilder's method
        const smoothedPlusDM = this.wilderSmoothing(plusDM, period);
        const smoothedMinusDM = this.wilderSmoothing(minusDM, period);
        const smoothedTR = this.wilderSmoothing(tr, period);
        // Calculate +DI and -DI
        const plusDI = smoothedPlusDM.map((v, i) => (v / smoothedTR[i]) * 100);
        const minusDI = smoothedMinusDM.map((v, i) => (v / smoothedTR[i]) * 100);
        // Calculate DX
        const dx = plusDI.map((v, i) => {
            const sum = plusDI[i] + minusDI[i];
            return sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100;
        });
        // Calculate ADX (smoothed DX)
        const adx = this.wilderSmoothing(dx, period);
        // Generate trend signals
        const trend = [];
        for (let i = 0; i < adx.length; i++) {
            if (adx[i] > 25) {
                if (plusDI[i] > minusDI[i]) {
                    trend.push('strong_uptrend');
                }
                else {
                    trend.push('strong_downtrend');
                }
            }
            else if (adx[i] > 20) {
                trend.push('weak');
            }
            else {
                trend.push('no_trend');
            }
        }
        // Pad arrays to match data length
        const padLength = data.length - adx.length - 1;
        const padded = {
            adx: [...Array(padLength).fill(NaN), ...adx],
            plusDI: [...Array(padLength).fill(NaN), ...plusDI],
            minusDI: [...Array(padLength).fill(NaN), ...minusDI],
            trend: [...Array(padLength).fill('no_trend'), ...trend],
        };
        return padded;
    }
    /**
     * Calculate CCI (Commodity Channel Index)
     * Identifies cyclical trends
     */
    calculateCCI(data, period = 20, constant = 0.015) {
        logger.debug(`[AdvancedIndicator] Calculating CCI (period: ${period})`);
        const typicalPrice = data.map(d => (d.high + d.low + d.close) / 3);
        const sma = this.calculateSMA(typicalPrice, period);
        const cci = [];
        const signal = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                cci.push(NaN);
                signal.push('neutral');
                continue;
            }
            const slice = typicalPrice.slice(i - period + 1, i + 1);
            const mean = sma[i];
            const meanDeviation = slice.reduce((sum, val) => sum + Math.abs(val - mean), 0) / period;
            const cciValue = (typicalPrice[i] - mean) / (constant * meanDeviation);
            cci.push(cciValue);
            if (cciValue > 100) {
                signal.push('overbought');
            }
            else if (cciValue < -100) {
                signal.push('oversold');
            }
            else {
                signal.push('neutral');
            }
        }
        return { cci, signal };
    }
    /**
     * Calculate Williams %R
     * Momentum indicator
     */
    calculateWilliamsR(data, period = 14) {
        logger.debug(`[AdvancedIndicator] Calculating Williams %R (period: ${period})`);
        const wr = [];
        const signal = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                wr.push(NaN);
                signal.push('neutral');
                continue;
            }
            const slice = data.slice(i - period + 1, i + 1);
            const highestHigh = Math.max(...slice.map(d => d.high));
            const lowestLow = Math.min(...slice.map(d => d.low));
            const close = data[i].close;
            const wrValue = ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
            wr.push(wrValue);
            if (wrValue > -20) {
                signal.push('overbought');
            }
            else if (wrValue < -80) {
                signal.push('oversold');
            }
            else {
                signal.push('neutral');
            }
        }
        return { wr, signal };
    }
    /**
     * Calculate Ichimoku Cloud
     * Japanese trend indicator
     */
    calculateIchimoku(data, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52) {
        logger.debug(`[AdvancedIndicator] Calculating Ichimoku Cloud`);
        const tenkan = this.calculateMidpoint(data, tenkanPeriod);
        const kijun = this.calculateMidpoint(data, kijunPeriod);
        const senkouA = tenkan.map((v, i) => (v + kijun[i]) / 2);
        const senkouB = this.calculateMidpoint(data, senkouBPeriod);
        const chikou = data.map((d, i) => i >= kijunPeriod ? d.close : NaN);
        const signal = [];
        for (let i = 0; i < data.length; i++) {
            if (isNaN(tenkan[i]) || isNaN(kijun[i])) {
                signal.push('neutral');
            }
            else if (tenkan[i] > kijun[i] && data[i].close > senkouA[i] && data[i].close > senkouB[i]) {
                signal.push('bullish');
            }
            else if (tenkan[i] < kijun[i] && data[i].close < senkouA[i] && data[i].close < senkouB[i]) {
                signal.push('bearish');
            }
            else {
                signal.push('neutral');
            }
        }
        return { tenkan, kijun, senkouA, senkouB, chikou, signal };
    }
    /**
     * Calculate VWAP (Volume Weighted Average Price)
     * Intraday indicator
     */
    calculateVWAP(data) {
        logger.debug(`[AdvancedIndicator] Calculating VWAP`);
        const vwap = [];
        const deviation = [];
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;
        for (let i = 0; i < data.length; i++) {
            const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
            const tpv = typicalPrice * data[i].volume;
            cumulativeTPV += tpv;
            cumulativeVolume += data[i].volume;
            const vwapValue = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : NaN;
            vwap.push(vwapValue);
            const dev = !isNaN(vwapValue) ? Math.abs(data[i].close - vwapValue) / vwapValue * 100 : NaN;
            deviation.push(dev);
        }
        return { vwap, deviation };
    }
    /**
     * Calculate OBV (On Balance Volume)
     * Volume momentum indicator
     */
    calculateOBV(data) {
        logger.debug(`[AdvancedIndicator] Calculating OBV`);
        const obv = [];
        const signal = [];
        let cumulativeOBV = 0;
        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                obv.push(data[i].volume);
                signal.push('neutral');
                cumulativeOBV = data[i].volume;
            }
            else {
                if (data[i].close > data[i - 1].close) {
                    // Price up: add volume
                    cumulativeOBV += data[i].volume;
                }
                else if (data[i].close < data[i - 1].close) {
                    // Price down: subtract volume
                    cumulativeOBV -= data[i].volume;
                }
                // Price unchanged: OBV unchanged
                obv.push(cumulativeOBV);
                // Generate signal based on OBV trend
                if (i >= 10) {
                    const obvSlice = obv.slice(i - 10, i + 1);
                    const obvSMA = obvSlice.reduce((a, b) => a + b, 0) / obvSlice.length;
                    if (cumulativeOBV > obvSMA * 1.05) {
                        signal.push('bullish');
                    }
                    else if (cumulativeOBV < obvSMA * 0.95) {
                        signal.push('bearish');
                    }
                    else {
                        signal.push('neutral');
                    }
                }
                else {
                    signal.push('neutral');
                }
            }
        }
        return { obv, signal };
    }
    /**
     * Calculate Volume MA (Volume Moving Average)
     * Identifies unusual volume activity
     */
    calculateVolumeMA(data, period = 20) {
        logger.debug(`[AdvancedIndicator] Calculating Volume MA (period: ${period})`);
        const volumes = data.map(d => d.volume);
        const volumeMA = this.calculateSMA(volumes, period);
        const volumeRatio = [];
        const signal = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1 || isNaN(volumeMA[i])) {
                volumeRatio.push(NaN);
                signal.push('normal');
                continue;
            }
            const ratio = volumes[i] / volumeMA[i];
            volumeRatio.push(ratio);
            if (ratio > 1.5) {
                signal.push('high_volume');
            }
            else if (ratio < 0.5) {
                signal.push('low_volume');
            }
            else {
                signal.push('normal');
            }
        }
        return { volumeMA, volumeRatio, signal };
    }
    // ============ HELPER METHODS ============
    calculateSMA(data, period) {
        const sma = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1 || isNaN(data[i])) {
                sma.push(NaN);
                continue;
            }
            const slice = data.slice(i - period + 1, i + 1).filter(v => !isNaN(v));
            const sum = slice.reduce((a, b) => a + b, 0);
            sma.push(sum / slice.length);
        }
        return sma;
    }
    wilderSmoothing(data, period) {
        const smoothed = [];
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                sum += data[i];
                smoothed.push(NaN);
            }
            else if (i === period - 1) {
                sum += data[i];
                smoothed.push(sum / period);
            }
            else {
                const value = (smoothed[i - 1] * (period - 1) + data[i]) / period;
                smoothed.push(value);
            }
        }
        return smoothed;
    }
    calculateMidpoint(data, period) {
        const midpoint = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                midpoint.push(NaN);
                continue;
            }
            const slice = data.slice(i - period + 1, i + 1);
            const highest = Math.max(...slice.map(d => d.high));
            const lowest = Math.min(...slice.map(d => d.low));
            midpoint.push((highest + lowest) / 2);
        }
        return midpoint;
    }
}
