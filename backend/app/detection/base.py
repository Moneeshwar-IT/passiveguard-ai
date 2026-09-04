import abc
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class DetectionResult(BaseModel):
    """
    Standardized result contract returned by all PassiveGuard AI threat detectors.
    """
    threat_class: str = Field(..., description="Threat classification label (e.g. DDoS, C2_Beaconing, DGA)")
    score: float = Field(..., ge=0.0, le=1.0, description="Raw uncalibrated anomaly score between 0.0 and 1.0")
    severity: str = Field(..., description="Mapped severity level: INFO, LOW, MEDIUM, HIGH, CRITICAL")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Key features and heuristics triggering detection")
    detector_name: str = Field(..., description="Name of detector module generating this result")
    model_version: str = Field(default="v0.1.0-scaffold", description="Version string of the underlying detector/model")

    model_config = ConfigDict(frozen=True)


class BaseDetector(abc.ABC):
    """
    Abstract Base Class for all threat detection engines.
    Ensures modularity and strict adherence to the DetectionResult contract.
    """
    
    @property
    @abc.abstractmethod
    def detector_name(self) -> str:
        """Name of the detector module."""
        pass

    @property
    @abc.abstractmethod
    def model_version(self) -> str:
        """Version of the detector model."""
        pass

    @abc.abstractmethod
    def analyze(self, features: Any) -> DetectionResult:
        """
        Analyze extracted features and return a standardized DetectionResult.
        Must be strictly passive and read-only.
        """
        pass
