from __future__ import annotations

from typing import Dict, Any, List, Optional, Set
import logging
import pandas as pd

from .mt5_client import MT5Client
from .indicator_service import IndicatorService
from .condition_evaluator import ConditionEvaluator
from .risk_manager import RiskManager
from .order_executor import OrderExecutor
from .strategy_adapter import normalize_rules
from ..ml.engine import MLEngine
from ..core.supervisor_client import SupervisorClient


logger = logging.getLogger(__name__)


def new_iso_timestamp() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat() + 'Z'


SESSION_WINDOWS = {
    'London': [(7, 16)],
    'NewYork': [(12, 21)],
    'Tokyo': [(0, 9)],
    'Sydney': [(21, 6)],
}


class StrategyExecutor:
    def __init__(self, mt5: MT5Client, platform_url: str, api_key: str, api_secret: str, executor_id: str) -> None:
        self.mt5 = mt5
        self.ind = IndicatorService()
        self.eval = ConditionEvaluator()
        self.risk = RiskManager()
        self.order = OrderExecutor(mt5)
        self.ml = MLEngine()
        self.supervisor = SupervisorClient(platform_url, api_key, api_secret, executor_id)
        self.active: Dict[str, Dict[str, Any]] = {}
        self.partial_tracker: Dict[int, set] = {}

    def start(self, strategy_cmd: Dict[str, Any]) -> Dict[str, Any]:
        p = strategy_cmd.get('parameters', {})
        sid = p.get('strategyId')
        if not sid:
            return {"success": False, "error": "Missing strategyId"}
        self.active[sid] = {
            "strategy": p,
            "rules": normalize_rules(p.get('rules') or {}),
            "symbol": p.get('symbol'),
            "timeframe": p.get('timeframe'),
        }
        logger.info("Started strategy %s", sid)
        return {"success": True}

    def stop(self, strategy_id: str) -> Dict[str, Any]:
        self.active.pop(strategy_id, None)
        return {"success": True}

    async def evaluate_once(self, strategy_id: str) -> Dict[str, Any]:
        st = self.active.get(strategy_id)
        if not st:
            return {"success": False, "error": "Not active"}
        symbol = st["symbol"]
        tf = st["timeframe"]
        rules = st["rules"]
        required = self._collect_required_indicators(rules)
        timeframe_map = self._collect_timeframes(rules, tf, required)

        snapshots: Dict[str, Dict[str, Any]] = {}
        for timeframe, indicators in timeframe_map.items():
            snap = self._build_snapshot(symbol, timeframe, indicators)
            if snap is None:
                return {"success": False, "error": f"No candles for {timeframe}"}
            snapshots[timeframe] = snap

        main_snap = snapshots[tf]

        action, side, metrics = self._evaluate_entry(rules, snapshots, tf)

        # Filters
        filters_result = self._evaluate_filters(rules, symbol, snapshots, tf, metrics)
        if not filters_result["pass"]:
            action = 'HOLD'

        # ML scoring
        features = {
            'rsi': metrics.get('rsi', 50),
            'macd_diff': metrics.get('macd', 0) - metrics.get('macd_signal', 0),
            'atr': metrics.get('atr', 0),
            'spread': filters_result.get('spread', 0),
        }
        signal_score = self.ml.predict_signal_quality(features)

        # LLM supervisor
        sup_ctx = {
            'phase': 'pre_trade',
            'symbol': symbol,
            'timeframe': tf,
            'proposed_action': action,
            'risk': {'lot': 0, 'sl_pips': 0, 'tp_pips': 0, 'daily_loss_pct': 0},
            'filters': {'spread': filters_result.get('spread', 0), 'atr': metrics.get('atr', 0)},
            'ml': {'signal_score': float(signal_score), 'regime': 'normal', 'anomaly': False},
            'positions_snapshot': {'count': filters_result.get('open_positions', 0)},
        }
        decision = await self.supervisor.evaluate(sup_ctx, timeout_s=6.0)
        if decision.get('action') == 'deny':
            action = 'HOLD'
        elif decision.get('action') == 'require_confirmation' and signal_score < 0.7:
            action = 'HOLD'

        result = {
            "action": action,
            "score": signal_score,
            "atr": metrics.get('atr', 0),
            "filters": filters_result,
            "decision": decision,
        }

        # Manage existing positions (trailing / partial / exit)
        position_actions = self._manage_open_positions(strategy_id, rules, symbol, metrics, main_snap)
        if position_actions:
            result['positionActions'] = position_actions

        if action.startswith('OPEN_') and side:
            open_res = self._execute_open(strategy_id, rules, symbol, side, metrics, signal_score)
            result.update(open_res)

        return result

    def _get_candles(self, symbol: str, timeframe: str, count: int) -> List[Dict[str, Any]]:
        # Use MT5 rates; fallback simulate empty list if mt5 missing
        try:
            import MetaTrader5 as mt5
            tf_map = {
                'M1': mt5.TIMEFRAME_M1,
                'M5': mt5.TIMEFRAME_M5,
                'M15': mt5.TIMEFRAME_M15,
                'M30': mt5.TIMEFRAME_M30,
                'H1': mt5.TIMEFRAME_H1,
                'H4': mt5.TIMEFRAME_H4,
                'D1': mt5.TIMEFRAME_D1,
            }
            tf_const = tf_map.get(timeframe, mt5.TIMEFRAME_M15)
            rates = mt5.copy_rates_from_pos(symbol, tf_const, 0, count)
            if rates is None:
                return []
            out: List[Dict[str, Any]] = []
            for r in rates:
                out.append({
                    'time': int(r['time']),
                    'open': float(r['open']),
                    'high': float(r['high']),
                    'low': float(r['low']),
                    'close': float(r['close']),
                    'volume': float(r.get('tick_volume') or r.get('real_volume') or 0),
                })
            return out
        except Exception:
            return []

    def _collect_required_indicators(self, rules: Dict[str, Any]) -> List[str]:
        indicators: Set[str] = {'price', 'atr', 'rsi', 'macd', 'macd_signal', 'ema_50'}
        for cond in rules.get('entry', {}).get('conditions', []) or []:
            if not isinstance(cond, dict):
                continue
            ind = cond.get('indicator')
            val = cond.get('value')
            if isinstance(ind, str):
                indicators.add(ind)
            if isinstance(val, str):
                indicators.add(val)
        return list(indicators)

    def _collect_timeframes(self, rules: Dict[str, Any], main_tf: str, required: List[str]) -> Dict[str, Set[str]]:
        tf_map: Dict[str, Set[str]] = {main_tf: set(required)}
        entry = rules.get('entry', {})
        for cond in entry.get('conditions', []) or []:
            if not isinstance(cond, dict):
                continue
            mtf = cond.get('_mtf', {})
            tf = mtf.get('timeframe')
            if not tf:
                continue
            tf_map.setdefault(tf, {'price', 'atr'})
            ind = cond.get('indicator')
            val = cond.get('value')
            if isinstance(ind, str):
                tf_map[tf].add(ind)
            if isinstance(val, str):
                tf_map[tf].add(val)
        return tf_map

    def _build_snapshot(self, symbol: str, timeframe: str, indicators: set) -> Optional[Dict[str, Any]]:
        candles = self._get_candles(symbol, timeframe, 400)
        if not candles:
            return None
        df = self.ind.to_df(candles)
        cache: Dict[str, pd.Series] = {}
        for name in indicators or []:
            self.ind.get_series(name, df, cache)
        # Ensure commonly used
        self.ind.get_series('price', df, cache)
        return {
            'df': df,
            'cache': cache,
            'last': lambda name: self.ind.last(self.ind.get_series(name, df, cache)),
            'prev': lambda name: self.ind.prev(self.ind.get_series(name, df, cache)),
        }

    def _evaluate_entry(self, rules: Dict[str, Any], snapshots: Dict[str, Dict[str, Any]], main_tf: str):
        entry = rules.get('entry', {})
        logic = (entry.get('logic') or 'AND').upper()
        conditions = entry.get('conditions') or []
        votes: List[bool] = []
        metrics: Dict[str, float] = {}

        for cond in conditions:
            indicator = str(cond.get('indicator'))
            op = str(cond.get('condition'))
            value = cond.get('value')
            mtf = cond.get('_mtf', {})
            tf = mtf.get('timeframe') or main_tf
            snap = snapshots.get(tf)
            if not snap:
                votes.append(False)
                continue
            left_now = snap['last'](indicator)
            right_now = snap['last'](value) if isinstance(value, str) else value
            left_prev = snap['prev'](indicator)
            right_prev = snap['prev'](value) if isinstance(value, str) else value
            metrics[indicator] = left_now
            if isinstance(value, str):
                metrics[value] = right_now

            if op in ('crosses_above', 'crosses_below'):
                ok = self.eval.crosses(left_prev, left_now, right_prev, right_now, op)
            else:
                ok = self.eval.compare(left_now, op, right_now)

            if mtf.get('required') and not ok:
                votes.append(False)
                continue
            votes.append(bool(ok))

        entry_ok = all(votes) if logic == 'AND' else any(votes)
        action = 'HOLD'
        side = None
        main_snap = snapshots[main_tf]
        price = main_snap['last']('price')
        ema50 = main_snap['last']('ema_50')
        metrics.update({
            'price': price,
            'ema_50': ema50,
            'atr': main_snap['last']('atr'),
            'macd': main_snap['last']('macd'),
            'macd_signal': main_snap['last']('macd_signal'),
            'rsi': main_snap['last']('rsi'),
        })

        if entry_ok:
            side = 'BUY' if price >= ema50 else 'SELL'
            action = f'OPEN_{side}'
        return action, side, metrics

    def _evaluate_filters(self, rules: Dict[str, Any], symbol: str, snapshots: Dict[str, Dict[str, Any]], main_tf: str, metrics: Dict[str, float]) -> Dict[str, Any]:
        result = {"pass": True}

        # Spread filter
        spread_filter = rules.get('spreadFilter') or {}
        spread = 0.0
        if spread_filter.get('enabled'):
            spread = self._current_spread(symbol)
            result['spread'] = spread
            max_spread = float(spread_filter.get('maxSpread') or 0)
            if max_spread and spread > max_spread:
                if spread_filter.get('action') == 'REDUCE_SIZE':
                    result['pass'] = True
                    result['lot_multiplier'] = 0.5
                else:
                    result['pass'] = False

        # Session filter
        session_filter = rules.get('sessionFilter') or {}
        if session_filter.get('enabled'):
            if not self._session_allowed(session_filter):
                result['pass'] = False

        # Volatility filter
        vol_filter = rules.get('volatilityFilter') or {}
        if vol_filter.get('enabled'):
            atr = metrics.get('atr', 0)
            min_atr = float(vol_filter.get('minATR') or 0)
            max_atr = float(vol_filter.get('maxATR') or 1e9)
            if atr < min_atr or atr > max_atr:
                action_cfg = vol_filter.get('action', {})
                if atr < min_atr and action_cfg.get('belowMin') == 'SKIP':
                    result['pass'] = False
                if atr > max_atr and action_cfg.get('aboveMax') in ('SKIP', 'PAUSE'):
                    result['pass'] = False

        # Correlation filter (simple exposure check)
        corr_filter = rules.get('correlationFilter') or {}
        if corr_filter.get('enabled'):
            if self._is_correlated_exposure(symbol, corr_filter):
                result['pass'] = False

        result['open_positions'] = self._count_positions(symbol)
        return result

    def _current_spread(self, symbol: str) -> float:
        try:
            import MetaTrader5 as mt5
            tick = mt5.symbol_info_tick(symbol)
            if not tick:
                return 0.0
            pip = 0.0001 if '.' in symbol and not symbol.endswith('JPY') else 0.01
            return (tick.ask - tick.bid) / pip
        except Exception:
            return 0.0

    def _session_allowed(self, cfg: Dict[str, Any]) -> bool:
        from datetime import datetime
        now = datetime.utcnow()
        hour = now.hour
        sessions = cfg.get('allowedSessions') or []
        if not sessions:
            return True
        for session in sessions:
            ranges = SESSION_WINDOWS.get(session, [])
            for start, end in ranges:
                if start <= end and start <= hour <= end:
                    return True
                if start > end and (hour >= start or hour <= end):
                    return True
        return False

    def _is_correlated_exposure(self, symbol: str, cfg: Dict[str, Any]) -> bool:
        pairs = cfg.get('checkPairs') or []
        if not pairs:
            return False
        try:
            import MetaTrader5 as mt5
            positions = mt5.positions_get()
            if not positions:
                return False
            for pos in positions:
                if pos.symbol in pairs and pos.symbol != symbol and pos.volume > 0:
                    if cfg.get('skipHighlyCorrelated'):
                        return True
            return False
        except Exception:
            return False

    def _execute_open(self, strategy_id: str, rules: Dict[str, Any], symbol: str, side: str, metrics: Dict[str, float], signal_score: float) -> Dict[str, Any]:
        exit_rules = rules.get('exit') or {}
        sl_pips = 25.0
        tp_pips = 40.0
        atr = metrics.get('atr', 0)
        if 'stopLoss' in exit_rules and isinstance(exit_rules['stopLoss'], dict):
            sl = exit_rules['stopLoss']
            if sl.get('type') == 'pips':
                sl_pips = float(sl.get('value') or sl_pips)
            elif sl.get('type') == 'atr':
                mult = float(sl.get('atrMultiplier') or 1.5)
                sl_pips = max(5.0, mult * atr)
        if 'takeProfit' in exit_rules and isinstance(exit_rules['takeProfit'], dict):
            tp = exit_rules['takeProfit']
            if tp.get('type') == 'pips':
                tp_pips = float(tp.get('value') or tp_pips)
            elif tp.get('type') in ('rr_ratio', 'partial'):
                rr = float(tp.get('rrRatio') or 1.6)
                tp_pips = max(10.0, rr * sl_pips)

        account = self.mt5.account_info() or {}
        pip_value = self.order.pip_value(symbol)
        risk_params = rules.get('dynamicRisk') or {}
        if not risk_params:
            risk_params = rules.get('riskManagement') or {}
        lots = self.risk.lot_size(account, risk_params, sl_pips, pip_value)

        # Spread filter multiplier
        exit_filters = rules.get('spreadFilter') or {}
        if exit_filters.get('enabled') and exit_filters.get('action') == 'REDUCE_SIZE':
            lots *= 0.5

        price = metrics.get('price', 0)
        pip_size = 0.0001 if '.' in symbol and not symbol.endswith('JPY') else 0.01
        sl_price = price - sl_pips * pip_size if side == 'BUY' else price + sl_pips * pip_size
        tp_price = price + tp_pips * pip_size if side == 'BUY' else price - tp_pips * pip_size

        order_res = self.order.open_position(symbol, side, lots, sl=sl_price, tp=tp_price,
                                             comment=f"{strategy_id}:{symbol}:{side}")
        trade_payload = None
        if order_res.get('success') and order_res.get('ticket'):
            trade_payload = {
                "ticket": str(order_res['ticket']),
                "symbol": symbol,
                "type": side,
                "lots": float(lots),
                "openPrice": float(metrics.get('price', 0)),
                "openTime": new_iso_timestamp(),
                "stopLoss": sl_price,
                "takeProfit": tp_price,
                "strategyId": strategy_id,
            }
        return {
            "order": order_res,
            "lots": lots,
            "sl": sl_price,
            "tp": tp_price,
            "sl_pips": sl_pips,
            "tp_pips": tp_pips,
            "trade": trade_payload,
        }

    def _manage_open_positions(self, strategy_id: str, rules: Dict[str, Any], symbol: str, metrics: Dict[str, float], snap: Dict[str, Any]) -> List[Dict[str, Any]]:
        actions: List[Dict[str, Any]] = []
        try:
            import MetaTrader5 as mt5
            positions = mt5.positions_get(symbol=symbol)
        except Exception:
            positions = None
        if not positions:
            return actions

        trailing = (rules.get('exit') or {}).get('trailing') or {}
        enhanced = (rules.get('exit') or {}).get('enhancedPartialExits') or {}
        price = metrics.get('price', 0)
        pip_size = 0.0001 if '.' in symbol and not symbol.endswith('JPY') else 0.01

        for pos in positions:
            ticket = pos.ticket
            side = 'BUY' if pos.type == mt5.ORDER_TYPE_BUY else 'SELL'

            # Trailing stop
            if trailing.get('enabled'):
                distance = float(trailing.get('distance') or 20)
                if side == 'BUY':
                    new_sl = max(pos.sl or 0, price - distance * pip_size)
                    if new_sl > (pos.sl or 0):
                        res = self.order.modify_sl_tp(ticket, symbol, new_sl, pos.tp)
                        actions.append({"ticket": ticket, "action": "trail", "result": res})
                else:
                    new_sl = min(pos.sl or 0 or price, price + distance * pip_size)
                    if new_sl < (pos.sl or price + distance * pip_size):
                        res = self.order.modify_sl_tp(ticket, symbol, new_sl, pos.tp)
                        actions.append({"ticket": ticket, "action": "trail", "result": res})

            # Enhanced partial exits
            if enhanced.get('enabled') and enhanced.get('levels'):
                executed = self.partial_tracker.setdefault(ticket, set())
                rr_base = self._rr_ratio(pos, pip_size)
                for idx, level in enumerate(enhanced['levels']):
                    level_id = f"{idx}"
                    if level_id in executed:
                        continue
                    if level.get('type') == 'rr_ratio':
                        target_rr = float(level.get('value') or 1.0)
                        if rr_base >= target_rr:
                            volume = pos.volume * (float(level.get('percentage') or 0) / 100.0)
                            res = self.order.close_partial(ticket, symbol, volume, side)
                            executed.add(level_id)
                            actions.append({"ticket": ticket, "action": "partial", "level": level_id, "result": res})
                            if level.get('moveStopToBreakeven'):
                                be = pos.price_open
                                mod = self.order.modify_sl_tp(ticket, symbol, be, pos.tp)
                                actions.append({"ticket": ticket, "action": "breakeven", "result": mod})

        return actions

    def _rr_ratio(self, pos, pip_size: float) -> float:
        try:
            import MetaTrader5 as mt5
            tick = mt5.symbol_info_tick(pos.symbol)
            if not tick:
                return 0.0
            price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
            if pos.type == mt5.ORDER_TYPE_BUY:
                reward = price - pos.price_open
                risk = pos.price_open - (pos.sl or (pos.price_open - 20 * pip_size))
            else:
                reward = pos.price_open - price
                risk = (pos.sl or (pos.price_open + 20 * pip_size)) - pos.price_open
            if risk <= 0:
                return 0.0
            return (reward / pip_size) / (risk / pip_size)
        except Exception:
            return 0.0

    def _count_positions(self, symbol: str) -> int:
        try:
            import MetaTrader5 as mt5
            positions = mt5.positions_get()
            if not positions:
                return 0
            return len([p for p in positions if p.symbol == symbol])
        except Exception:
            return 0
