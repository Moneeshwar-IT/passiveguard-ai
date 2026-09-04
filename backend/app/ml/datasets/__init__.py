"""
PassiveGuard AI — ML Dataset Adapters Package (Module 16)
"""
from app.ml.datasets.base import BaseDatasetAdapter, PASSIVEGUARD_FEATURE_SCHEMA
from app.ml.datasets.unsw_nb15 import UNSWNB15Adapter
from app.ml.datasets.cse_cic_ids2018 import CSECICIDS2018Adapter
from app.ml.datasets.synthetic_fixture import SyntheticFixtureAdapter
from app.ml.datasets.registry import DatasetAdapterRegistry, DatasetRegistry, DatasetMetadata, dataset_registry

__all__ = [
    "BaseDatasetAdapter",
    "PASSIVEGUARD_FEATURE_SCHEMA",
    "UNSWNB15Adapter",
    "CSECICIDS2018Adapter",
    "SyntheticFixtureAdapter",
    "DatasetAdapterRegistry",
    "DatasetRegistry",
    "DatasetMetadata",
    "dataset_registry"
]
