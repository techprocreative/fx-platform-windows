from __future__ import annotations

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd


class IndicatorService:
    """Vectorized indicator calculations using numpy/pandas.
    Avoids TA-Lib dependency for portability. Provides dynamic indicator lookup."""

    def to_df(self, candles: List[Dict[str, Any]]) -> pd.DataFrame:
        df = pd.DataFrame(candles)
        # Expect fields: time, open, high, low, close, tick_volume/volume
        if 'time' in df.columns:
            df['time'] = pd.to_datetime(df['time'], unit='s', errors='ignore')
            df = df.set_index('time')
        return df

    @staticmethod
    def sma(series: pd.Series, period: int) -> pd.Series:
        return series.rolling(window=period, min_periods=period).mean()

    @staticmethod
    def ema(series: pd.Series, period: int) -> pd.Series:
        return series.ewm(span=period, adjust=False, min_periods=period).mean()

    @staticmethod
    def rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = (delta.clip(lower=0)).rolling(window=period, min_periods=period).mean()
        loss = (-delta.clip(upper=0)).rolling(window=period, min_periods=period).mean()
        rs = gain / (loss.replace(0, np.nan))
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50)

    @staticmethod
    def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
        ema_fast = IndicatorService.ema(series, fast)
        ema_slow = IndicatorService.ema(series, slow)
        macd = ema_fast - ema_slow
        sig = IndicatorService.ema(macd, signal)
        hist = macd - sig
        return macd, sig, hist

    @staticmethod
    def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
        prev_close = close.shift(1)
        tr = pd.concat([
            (high - low).abs(),
            (high - prev_close).abs(),
            (low - prev_close).abs()
        ], axis=1).max(axis=1)
        return tr.rolling(window=period, min_periods=period).mean()

    @staticmethod
    def adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
        up = high.diff()
        down = -low.diff()
        plus_dm = np.where((up > down) & (up > 0), up, 0.0)
        minus_dm = np.where((down > up) & (down > 0), down, 0.0)
        tr = IndicatorService.atr(high, low, close, 1)
        atr_n = tr.rolling(window=period, min_periods=period).mean()
        plus_di = 100 * pd.Series(plus_dm, index=high.index).rolling(period).sum() / atr_n
        minus_di = 100 * pd.Series(minus_dm, index=high.index).rolling(period).sum() / atr_n
        dx = (abs(plus_di - minus_di) / (plus_di + minus_di)).replace([np.inf, -np.inf], np.nan) * 100
        return dx.rolling(window=period, min_periods=period).mean()

    @staticmethod
    def stochastic(high: pd.Series, low: pd.Series, close: pd.Series, k_period: int = 14, d_period: int = 3) -> Tuple[pd.Series, pd.Series]:
        lowest_low = low.rolling(window=k_period, min_periods=k_period).min()
        highest_high = high.rolling(window=k_period, min_periods=k_period).max()
        k = 100 * (close - lowest_low) / (highest_high - lowest_low).replace(0, np.nan)
        d = k.rolling(window=d_period, min_periods=d_period).mean()
        return k.fillna(50), d.fillna(50)

    @staticmethod
    def bollinger(series: pd.Series, period: int = 20, mult: float = 2.0) -> Tuple[pd.Series, pd.Series, pd.Series]:
        ma = IndicatorService.sma(series, period)
        sd = series.rolling(window=period, min_periods=period).std()
        upper = ma + mult * sd
        lower = ma - mult * sd
        return lower, ma, upper

    def get_series(self, name: str, df: pd.DataFrame, cache: Dict[str, pd.Series]) -> pd.Series:
        key = name.lower()
        if key in cache:
            return cache[key]

        close = df['close']
        high = df['high']
        low = df['low']

        series: pd.Series
        if key == 'price':
            series = close
        elif key.startswith('ema_'):
            period = int(key.split('_')[1])
            series = self.ema(close, period)
        elif key.startswith('sma_'):
            period = int(key.split('_')[1])
            series = self.sma(close, period)
        elif key.startswith('rsi'):
            parts = key.split('_')
            period = int(parts[1]) if len(parts) > 1 else 14
            series = self.rsi(close, period)
        elif key == 'macd':
            macd, signal, hist = self.macd(close)
            cache['macd'] = macd
            cache['macd_signal'] = signal
            cache['macd_hist'] = hist
            return cache[key]
        elif key == 'macd_signal':
            _, signal, _ = self.macd(close)
            series = signal
        elif key == 'macd_hist':
            _, _, hist = self.macd(close)
            series = hist
        elif key in ('stochastic_k', 'stochastic_d'):
            k, d = self.stochastic(high, low, close)
            cache['stochastic_k'] = k
            cache['stochastic_d'] = d
            return cache[key]
        elif key == 'atr':
            series = self.atr(high, low, close)
        elif key == 'adx':
            series = self.adx(high, low, close)
        elif key.startswith('bollinger_'):
            lower, mid, upper = self.bollinger(close)
            cache['bollinger_lower'] = lower
            cache['bollinger_mid'] = mid
            cache['bollinger_upper'] = upper
            return cache[key]
        else:
            # Fallback: return close series and log unknown
            series = close

        cache[key] = series
        return series

    def last(self, series: pd.Series) -> float:
        try:
            return float(series.dropna().iloc[-1])
        except Exception:
            return float('nan')

    def prev(self, series: pd.Series) -> float:
        try:
            return float(series.dropna().iloc[-2])
        except Exception:
            return float('nan')
