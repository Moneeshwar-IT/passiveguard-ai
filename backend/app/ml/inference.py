"""
PassiveGuard AI — In-Memory Model Inference Interface (Module 12)

STRICT PASSIVE CONSTRAINT:
Executes lightweight ML inference on observed feature vectors in memory.
Loads model binaries once, evaluates incoming flow features, returns uncalibrated anomaly scores [0.0, 1.0],
and handles missing model artifacts gracefully without crashing.
"""
import os
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import joblib
from pydantic import BaseModel, Field

from app.features.models import FeatureVector

logger = logging.getLogger(__name__)


class MLPrediction(BaseModel):
    """
    Standardized ML Inference Prediction Result container.
    """
    label: str = Field(..., description="Predicted canonical threat class (e.g. DDOS, BENIGN)")
    score: float = Field(..., ge=0.0, le=1.0, description="Normalized uncalibrated anomaly score [0.0, 1.0]")
    confidence: float = Field(default=0.85, ge=0.0, le=1.0, description="Heuristic evidence quality score")
    model_name: str = Field(..., description="Name of classifier model")
    model_version: str = Field(..., description="Version tag of classifier model artifact")
    features_used: List[str] = Field(default_factory=list, description="List of feature column names evaluated")
    top_contributing_features: Dict[str, float] = Field(default_factory=dict, description="Top feature contribution scores")


class MLInferenceEngine:
    """
    In-Memory ML Inference Engine.
    Loads joblib pipeline artifacts once and executes predictions on feature vectors.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self._model = None
        self._scaler = None
        self._feature_cols: List[str] = []
        self._target_threat: str = "DDOS"
        self._model_name: str = "RandomForestClassifier"
        self._model_version: str = "rf-v1.0"
        self._is_loaded: bool = False

        if model_path:
            self.load_model(model_path)

    def load_model(self, model_path: str) -> bool:
        """
        Loads joblib model artifact into memory.
        """
        if not os.path.exists(model_path):
            logger.warning(f"ML model artifact not found at '{model_path}'. ML inference disabled.")
            self._is_loaded = False
            return False

        try:
            artifact = joblib.load(model_path)
            if isinstance(artifact, dict):
                self._model = artifact.get("model")
                self._scaler = artifact.get("scaler")
                self._feature_cols = artifact.get("feature_cols", [])
                self._target_threat = artifact.get("target_threat_class", "DDOS")
                self._model_name = artifact.get("model_name", "RandomForestClassifier")
                self._model_version = artifact.get("model_version", "v1.0")
            else:
                # Raw scikit-learn model fallback
                self._model = artifact
                self._scaler = None
                self._feature_cols = [
                    "flow_packets_per_sec", "flow_bytes_per_sec", "tcp_syn_count",
                    "tcp_ack_count", "directional_byte_ratio", "directional_packet_ratio",
                    "flow_duration", "flow_packet_count", "flow_byte_count"
                ]

            self.model_path = model_path
            self._is_loaded = True
            logger.info(f"Loaded ML model artifact: {self._model_name} ({self._model_version}) from {model_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load ML model artifact from '{model_path}': {e}")
            self._is_loaded = False
            return False

    def is_available(self) -> bool:
        """Returns True if a valid ML model is loaded in memory."""
        return self._is_loaded and self._model is not None

    def predict(self, features: Any) -> Optional[MLPrediction]:
        """
        Executes prediction on incoming FeatureVector or dictionary.
        Returns None if model is unavailable or features are malformed.
        """
        if not self.is_available():
            logger.debug("ML predict called but no ML model is loaded.")
            return None

        try:
            # Extract feature dictionary
            if isinstance(features, FeatureVector):
                feat_dict = features.model_dump()
            elif isinstance(features, dict):
                feat_dict = dict(features)
            elif hasattr(features, "model_dump"):
                feat_dict = features.model_dump()
            elif hasattr(features, "__dict__"):
                feat_dict = dict(features.__dict__)
            else:
                logger.warning("Unsupported feature format passed to MLInferenceEngine.")
                return None

            # Build feature array matching feature_cols
            x_vals = []
            for col in self._feature_cols:
                val = feat_dict.get(col, 0.0)
                x_vals.append(float(val) if val is not None else 0.0)

            X_raw = np.array([x_vals])

            # Apply scaler if present
            if self._scaler is not None:
                X_scaled = self._scaler.transform(X_raw)
            else:
                X_scaled = X_raw

            # Execute model prediction with robust class mapping
            score = self._extract_threat_score(X_scaled)
            score_norm = min(1.0, max(0.0, score))
            label = self._target_threat if score_norm >= 0.50 else "BENIGN"

            # Top feature contribution approximation
            top_feats = {}
            if hasattr(self._model, "feature_importances_"):
                imps = self._model.feature_importances_
                for name, imp, val in zip(self._feature_cols, imps, x_vals):
                    top_feats[name] = round(float(imp * val), 4)

            return MLPrediction(
                label=label,
                score=round(score_norm, 4),
                confidence=round(min(1.0, 0.50 + (0.50 * score_norm)), 4),
                model_name=self._model_name,
                model_version=self._model_version,
                features_used=self._feature_cols,
                top_contributing_features=top_feats
            )
        except Exception as e:
            logger.error(f"Error during ML inference execution: {e}")
            return None

    def _extract_threat_score(self, X_scaled: np.ndarray) -> float:
        """
        Robustly extracts threat probability score from model outputs.
        Supports normal binary ordering [0, 1], reversed ordering [1, 0], string labels, and single-class models.
        """
        if hasattr(self._model, "predict_proba"):
            probs = self._model.predict_proba(X_scaled)[0]
            if hasattr(self._model, "classes_"):
                classes = list(self._model.classes_)
                pos_idx = None
                for idx, cls_val in enumerate(classes):
                    s_val = str(cls_val).strip().upper()
                    s_target = str(self._target_threat).strip().upper()
                    if cls_val in (1, True) or s_val in ("1", "TRUE", s_target):
                        pos_idx = idx
                        break

                if pos_idx is not None and pos_idx < len(probs):
                    return float(probs[pos_idx])

                # Single-class fallback handling
                if len(classes) == 1:
                    cls_val = classes[0]
                    s_val = str(cls_val).strip().upper()
                    if cls_val in (0, False) or s_val in ("0", "FALSE", "BENIGN"):
                        return 0.0
                    else:
                        return 1.0

                return float(probs[1]) if len(probs) > 1 else float(probs[0])
            else:
                return float(probs[1]) if len(probs) > 1 else float(probs[0])
        else:
            preds = self._model.predict(X_scaled)
            pred_val = preds[0]
            s_val = str(pred_val).strip().upper()
            s_target = str(self._target_threat).strip().upper()
            if pred_val in (1, True) or s_val in ("1", "TRUE", s_target):
                return 1.0
            elif pred_val in (0, False) or s_val in ("0", "FALSE", "BENIGN"):
                return 0.0
            else:
                try:
                    return float(pred_val)
                except ValueError:
                    return 0.0


# Global ML Inference Engine singleton instance
ml_inference_engine = MLInferenceEngine()
