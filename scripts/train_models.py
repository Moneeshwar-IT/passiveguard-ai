#!/usr/bin/env python3
"""
PassiveGuard AI — Reproducible ML Model Training & Real Dataset Validation (Module 16)

STRICT PASSIVE & REPRODUCIBILITY DIRECTIVE:
Executes reproducible offline ML model training (RandomForest / HistGradientBoosting) on real local public cybersecurity datasets (UNSW-NB15, CSE-CIC-IDS2018) or synthetic fixtures.
Enforces strict data leakage prevention (fits scalers on Train set ONLY).
Calculates actual measured evaluation metrics (Accuracy, Precision, Recall, Macro/Weighted F1, FPR, FNR, Confusion Matrix).
Persists model binaries (.joblib) and DataManifest provenance files (.json).
Does NOT perform automatic internet downloading or make network requests.
"""
import sys
import os
import argparse
import logging
from datetime import datetime, timezone

# Ensure backend app imports function smoothly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.ml.datasets import DatasetAdapterRegistry
from app.ml.trainer import ModelTrainer

logging.basicConfig(level=logging.INFO, format="%(asctime)s - [ML TRAINER] - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def run_training_pipeline(
    dataset_arg: str,
    target_threat: str,
    model_type: str,
    out_dir: str,
    split_strategy: str = "time_aware",
    imbalance_strategy: str = "balanced_weights",
    seed: int = 42
):
    """
    CLI entrypoint for running reproducible ML training and evaluation on local cybersecurity datasets.
    """
    print("\n" + "=" * 70)
    print("PASSIVEGUARD AI — REAL CYBERSECURITY DATASET ML TRAINING PIPELINE")
    print("=" * 70)
    print(f"Dataset Input:         {dataset_arg}")
    print(f"Target Threat Class:   {target_threat.upper()}")
    print(f"Model Classifier:     {model_type.upper()} (scikit-learn)")
    print(f"Split Strategy:       {split_strategy}")
    print(f"Imbalance Strategy:   {imbalance_strategy}")
    print(f"Random Seed:          {seed}")
    print(f"Output Directory:     {out_dir}")
    print(f"Mode:                 OFFLINE (Strict Passive Monitoring Enclave)")
    print("=" * 70 + "\n")

    trainer = ModelTrainer(random_seed=seed)
    manifest_dir = os.path.join(os.path.dirname(out_dir), "manifests")

    try:
        model, manifest = trainer.train_and_evaluate(
            dataset_name=dataset_arg,
            target_threat_class=target_threat.upper(),
            model_type=model_type.lower(),
            split_strategy=split_strategy,
            imbalance_strategy=imbalance_strategy,
            out_dir=out_dir,
            manifest_dir=manifest_dir
        )
    except FileNotFoundError as e:
        print(f"[STATUS] {e}")
        return

    metrics = manifest.evaluation_metrics
    audit = manifest.cleaning_audit
    overfit = manifest.overfitting_check or {}
    cm_s = metrics.get("confusion_matrix_summary", {})

    print("\n" + "=" * 70)
    print("PASSIVEGUARD AI — REAL DATASET VALIDATION REPORT")
    print("=" * 70)
    print(f"Dataset:                  {manifest.dataset_name} ({manifest.version})")
    print(f"Source:                   {manifest.source}")
    print(f"Target:                   {target_threat.upper()}")
    print(f"Model:                    {model_type.upper()} (scikit-learn)")
    print(f"Split Strategy:           {manifest.split_strategy}")
    print(f"Imbalance Strategy:       {manifest.imbalance_strategy}")
    print("-" * 70)
    print("DATASET SAMPLES")
    print(f"  Total Raw Samples:      {manifest.total_samples}")
    print(f"  Cleaned Evaluated:      {manifest.sample_counts.get('total', 0)}")
    print(f"  Training Set (70%):     {manifest.sample_counts.get('train', 0)}")
    print(f"  Validation Set (15%):   {manifest.sample_counts.get('validation', 0)}")
    print(f"  Test Set (15%):         {manifest.sample_counts.get('test', 0)}")
    print(f"  Rows Dropped/Cleaned:   {audit.get('rows_dropped', 0)}")
    print("-" * 70)
    print("CLASS DISTRIBUTION (Test Set)")
    print(f"  BENIGN:                 {manifest.class_distribution.get('BENIGN', 0)}")
    print(f"  {target_threat.upper()}:                   {manifest.class_distribution.get(target_threat.upper(), 0)}")
    print("-" * 70)
    print("TEST PERFORMANCE (Held-Out Test Set)")
    print(f"  Accuracy:               {metrics.get('accuracy', 0.0):.4f}")
    print(f"  Precision (Macro):      {metrics.get('precision_macro', 0.0):.4f}")
    print(f"  Recall (Macro):         {metrics.get('recall_macro', 0.0):.4f}")
    print(f"  F1 (Macro):             {metrics.get('f1_macro', 0.0):.4f}")
    print(f"  F1 (Weighted):          {metrics.get('f1_weighted', 0.0):.4f}")
    print(f"  False Positive Rate:    {metrics.get('false_positive_rate', 0.0):.4f}")
    print(f"  False Negative Rate:    {metrics.get('false_negative_rate', 0.0):.4f}")
    print("-" * 70)
    print("CONFUSION MATRIX (Test Set)")
    print(f"  TN: {cm_s.get('TN', 0):<8} | FP: {cm_s.get('FP', 0):<8}")
    print(f"  FN: {cm_s.get('FN', 0):<8} | TP: {cm_s.get('TP', 0):<8}")
    print("-" * 70)
    print("FEATURE AVAILABILITY CATEGORIZATION")
    for feat, status in manifest.feature_availability.items():
        print(f"  - {feat:<28}: {status}")
    print("-" * 70)
    print("MODEL ARTIFACT PROVENANCE")
    print(f"  Features Order ({manifest.feature_count}): {', '.join(manifest.feature_names[:4])}...")
    print(f"  Overfitting Gap (Train - Test F1): {overfit.get('overfitting_gap', 0.0):.4f}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PassiveGuard AI - Real Cybersecurity Dataset Training & Validation")
    parser.add_argument("--dataset", type=str, default="synthetic", help="Dataset adapter name (unsw_nb15, cse_cic_ids2018, synthetic)")
    parser.add_argument("--target", type=str, default="DDOS", help="Target threat class (DDOS, RECON_SCAN, C2_BEACON)")
    parser.add_argument("--model", type=str, default="rf", choices=["rf", "hist"], help="Classifier model type (rf=RandomForest, hist=HistGradientBoosting)")
    parser.add_argument("--out", type=str, default="./data/models", help="Output directory for model artifacts")
    parser.add_argument("--split-strategy", type=str, default="time_aware", choices=["time_aware", "stratified"], help="Split strategy for dataset partition")
    parser.add_argument("--imbalance-strategy", type=str, default="balanced_weights", choices=["balanced_weights", "undersample", "oversample"], help="Class imbalance handling strategy")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    run_training_pipeline(
        dataset_arg=args.dataset,
        target_threat=args.target,
        model_type=args.model,
        out_dir=args.out,
        split_strategy=args.split_strategy,
        imbalance_strategy=args.imbalance_strategy,
        seed=args.seed
    )
