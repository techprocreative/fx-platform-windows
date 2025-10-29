from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import os
import json
import httpx


@dataclass
class Decision:
    action: str  # 'allow' | 'deny' | 'require_confirmation'
    reason: str
    risks: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    score: Optional[float] = None  # confidence score 0..1


class Supervisor:
    """LLM-based supervisor for trade decisions and risk governance.

    Modes:
      - observe: does not block, only annotates decisions with advice.
      - enforce: can gate actions based on policies.
    """

    def __init__(self) -> None:
        self.mode = os.getenv("SUPERVISOR_MODE", "observe").lower()  # observe|enforce|off
        self.provider = os.getenv("LLM_PROVIDER", "openrouter").lower()  # openrouter|openai|none
        self.model = os.getenv("LLM_MODEL", "anthropic/claude-3.5-sonnet")
        self.timeout_s = float(os.getenv("LLM_TIMEOUT", "6.0"))  # keep low latency

    def enabled(self) -> bool:
        if self.mode == "off":
            return False
        if self.provider == "openrouter" and not os.getenv("OPENROUTER_API_KEY"):
            return False
        if self.provider == "openai" and not os.getenv("OPENAI_API_KEY"):
            return False
        return True

    async def evaluate(self, context: Dict[str, Any]) -> Decision:
        """Evaluate a pre-trade or post-trade context and return a decision.

        Context example (minimal):
          {
            "phase": "pre_trade"|"post_trade"|"anomaly",
            "symbol": "EURUSD",
            "timeframe": "M15",
            "proposed_action": "OPEN_BUY",
            "risk": { "lot": 0.02, "sl_pips": 25, "tp_pips": 40, "daily_loss_pct": 2.1 },
            "filters": { "spread": 1.4, "session": "London", "atr": 18 },
            "ml": { "signal_score": 0.74, "regime": "trend", "anomaly": false },
            "positions_snapshot": { "count": 2, "exposure": {"EURUSD": {"net": 0.04}} }
          }
        """
        if not self.enabled():
            return Decision(action="allow", reason="Supervisor disabled or not configured")

        try:
            decision = await self._call_llm(context)
        except Exception as e:
            # Fail-open by default in observe mode; fail-safe in enforce with allow+flag
            action = "allow"
            if self.mode == "enforce":
                action = "require_confirmation"
            return Decision(
                action=action,
                reason=f"LLM supervisor unavailable: {e}",
                risks=["llm_unavailable"],
                suggestions=["Check LLM provider configuration", "Reduce dependency on external gating"],
                score=None,
            )

        # If enforce mode and LLM returns deny/require_confirmation, pass it through
        if self.mode == "enforce":
            return decision

        # Observe mode: never block, only annotate
        if decision.action in ("deny", "require_confirmation"):
            decision.action = "allow"  # downgrade to allow
            decision.suggestions.insert(0, "Supervisor recommended caution; running in observe mode")
        return decision

    async def _call_llm(self, context: Dict[str, Any]) -> Decision:
        prompt = self._build_prompt(context)

        if self.provider == "openrouter":
            return await self._call_openrouter(prompt)
        elif self.provider == "openai":
            return await self._call_openai(prompt)
        else:
            return Decision(action="allow", reason="No LLM provider configured")

    def _build_prompt(self, context: Dict[str, Any]) -> str:
        policy = (
            "You are a trading risk supervisor. Make concise, actionable decisions. "
            "Follow these rules: (1) If daily loss near limit (>80%), prefer require_confirmation. "
            "(2) If spread > allowed or ATR outside range, prefer deny. "
            "(3) If correlation exposure high and proposed trade increases risk, prefer deny. "
            "(4) If ML signal score < 0.6, prefer require_confirmation. "
            "(5) Keep latency in mind; be decisive."
        )
        instructions = (
            "Reply strictly as minified JSON with keys: action (allow|deny|require_confirmation), "
            "reason (short), risks (array), suggestions (array), score (0..1)."
        )
        return (
            f"{policy}\n{instructions}\nContext:\n" + json.dumps(context, separators=(",", ":"))
        )

    async def _call_openrouter(self, prompt: str) -> Decision:
        api_key = os.getenv("OPENROUTER_API_KEY")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # Optional headers recommended by OpenRouter
            "HTTP-Referer": os.getenv("OPENROUTER_HTTP_REFERER", "https://localhost"),
            "X-Title": os.getenv("OPENROUTER_APP_TITLE", "FX Executor V2"),
        }
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a precise trading risk supervisor."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=body,
            )
            r.raise_for_status()
            data = r.json()
            content = data["choices"][0]["message"]["content"].strip()
            return self._parse_decision(content)

    async def _call_openai(self, prompt: str) -> Decision:  # pragma: no cover
        # Generic OpenAI-compatible call via httpx to keep deps minimal
        api_key = os.getenv("OPENAI_API_KEY")
        model = self.model or "gpt-4o-mini"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        body = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1}
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
            content = data["choices"][0]["message"]["content"].strip()
            return self._parse_decision(content)

    def _parse_decision(self, content: str) -> Decision:
        try:
            obj = json.loads(content)
            action = obj.get("action", "allow")
            reason = obj.get("reason", "")
            risks = obj.get("risks", []) or []
            suggestions = obj.get("suggestions", []) or []
            score = obj.get("score")
            return Decision(action=action, reason=reason, risks=risks, suggestions=suggestions, score=score)
        except Exception:
            # If parsing fails, default allow
            return Decision(action="allow", reason="Non-JSON LLM response")

