from __future__ import annotations

from typing import Dict, Any, Optional
import os
import joblib
import numpy as np


class MLEngine:
    """Lightweight ML engine for signal quality, regime detection, anomaly guard.

    - Loads optional joblib models from ./models directory.
    - Provides safe defaults when models are absent.
    """

    def __init__(self) -> None:
        base = os.path.dirname(__file__)
        self.models_dir = os.path.join(os.path.abspath(os.path.join(base, os.pardir)), "models")
        self.signal_model = self._load_model("signal_quality.joblib")
        self.regime_model = self._load_model("regime_classifier.joblib")
        self.anomaly_model = self._load_model("anomaly_detector.joblib")

    def _load_model(self, filename: str):
        path = os.path.join(self.models_dir, filename)
        if os.path.exists(path):
            try:
                return joblib.load(path)
            except Exception:
                return None
        return None

    def predict_signal_quality(self, features: Dict[str, Any]) -> float:
        """Return score 0..1 (higher is better)."""
        if self.signal_model is None:
            return 0.5
        x = self._to_vector(features)
        try:
            proba = getattr(self.signal_model, "predict_proba", None)
            if proba is not None:
                p = proba([x])[0]
                # Assume positive class at index 1
                return float(p[1]) if len(p) > 1 else float(p[0])
            else:
                y = self.signal_model.predict([x])[0]
                return float(y)
        except Exception:
            return 0.5

    def detect_regime(self, features: Dict[str, Any]) -> str:
        if self.regime_model is None:
            return "normal"
        x = self._to_vector(features)
        try:
            y = self.regime_model.predict([x])[0]
            return str(y)
        except Exception:
            return "normal"

    def detect_anomaly(self, features: Dict[str, Any]) -> bool:
        if self.anomaly_model is None:
            return False
        x = self._to_vector(features)
        try:
            y = self.anomaly_model.predict([x])[0]
            # For isolation forest etc., label -1 indicates anomaly
            return bool(y == -1 or y == 1 and hasattr(self.anomaly_model, "anomaly_") )
        except Exception:
            return False

    def _to_vector(self, features: Dict[str, Any]):
        # Simple deterministic mapping; production should maintain a feature schema
        keys = sorted(features.keys())
        return np.array([float(features[k]) if isinstance(features[k], (int, float)) else 0.0 for k in keys], dtype=float)

