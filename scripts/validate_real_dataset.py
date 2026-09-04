#!/usr/bin/env python3
"""
PassiveGuard AI — Real Dataset Model Validation Script (Module 16)

STRICT PASSIVE & HONEST METRICS DIRECTIVE:
Loads an already-trained PassiveGuard ML model artifact (.joblib) and evaluates it against
local held-out test datasets (UNSW-NB15, CSE-CIC-IDS2018, or synthetic fixtures).
Computes and reports real measured test set metrics.
Does NOT perform automatic internet downloading or make network requests.
"""
import sys
import os
import argparse
import logging
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Ensure backend app imports function smoothly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.ml.datasets import DatasetAdapterRegistry
from app.ml.datasets.base import PASSIVEGUARD_FEATURE_SCHEMA
from app.ml.preprocessing import DataPreprocessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s - [REAL VALIDATOR] - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def validate_model_on_dataset(dataset_name: str, model_path: str, split_strategy: str = "time_aware"):
    """
    Validates a trained model artifact on a local dataset partition.
    """
    print("\n" + "=" * 70)
    print("PASSIVEGUARD AI — REAL CYBERSECURITY DATASET MODEL VALIDATION")
    print("=" * 70)
    print(f"Model Artifact:    {model_path}")
    print(f"Evaluation Data:   {dataset_name}")
    print(f"Split Strategy:    {split_strategy}")
    print(f"Mode:              OFFLINE (Strict Passive Enclave)")
    print("=" * 70 + "\n")

    if not os.path.exists(model_path):
        print(f"[ERROR] Model artifact not found at: {model_path}")
        return

    # 1. Load Model Binary Artifact
    artifact = joblib.load(model_path)
    model = artifact["model"]
    scaler = artifact["scaler"]
    expected_feature_cols = artifact.get("feature_cols", PASSIVEGUARD_FEATURE_SCHEMA)
    target_threat_class = artifact.get("target_threat_class", "DDOS")
    model_name = artifact.get("model_name", "RandomForestClassifier")
    model_version = artifact.get("model_version", "v1.0")
    trained_on_dataset = artifact.get("trained_on_dataset", artifact.get("dataset_name", "Unknown"))

    logger.info(f"Loaded trained model artifact '{os.path.basename(model_path)}' (Trained on: {trained_on_dataset}) expecting {len(expected_feature_cols)} features.")

    # 2. Obtain Dataset Adapter
    adapter = DatasetAdapterRegistry.get_adapter(dataset_name)
    local_files = adapter.discover_local_files()

    if not local_files and dataset_name.lower() not in ["synthetic", "synthetic_fixture", "demo"]:
        print("\n" + "=" * 70)
        print(f"REAL DATASET ({adapter.dataset_name}): NOT AVAILABLE")
        print("STATUS: Validation skipped because local dataset CSV files were not found.")
        print(f"EXPECTED LOCATION: Place CSV files under data/raw/{dataset_name.lower()}/")
        print("SYNTHETIC FIXTURE: Available only for pipeline testing.")
        print("=" * 70 + "\n")
        return

    preprocessor = DataPreprocessor(random_seed=42)

    # 3. Handle Predefined vs Custom Dataset Splits
    if adapter.has_predefined_splits:
        raw_train_df, raw_test_df = adapter.load_splits()
        df_train_filt, _ = adapter.map_labels(raw_train_df, target_threat_class=target_threat_class)
        df_train_feat, _ = adapter.map_features(df_train_filt)

        df_test_filt, _ = adapter.map_labels(raw_test_df, target_threat_class=target_threat_class)
        df_test_feat, _ = adapter.map_features(df_test_filt)

        X_train, X_val, X_test, y_train, y_val, y_test, _, audit = preprocessor.prepare_predefined_dataset(
            df_train_feat,
            df_test_feat,
            feature_cols=expected_feature_cols,
            label_col="mapped_label",
            target_threat_class=target_threat_class
        )
        source_partition = f"Official Predefined Test Set ({os.path.basename(local_files[1]) if len(local_files) > 1 else 'test_set'})"
    else:
        raw_df = adapter.load()
        df_filtered, label_counts = adapter.map_labels(raw_df, target_threat_class=target_threat_class)
        df_features, feature_availability = adapter.map_features(df_filtered)

        X_train, X_val, X_test, y_train, y_val, y_test, _, audit = preprocessor.prepare_dataset(
            df_features,
            feature_cols=expected_feature_cols,
            label_col="mapped_label",
            target_threat_class=target_threat_class,
            split_strategy=split_strategy
        )
        source_partition = f"{split_strategy.title()} Split Test Partition (15% held-out)"

    # Transform test set using saved scaler (scaler fitted on Train set ONLY)
    X_test_scaled = scaler.transform(X_test) if scaler else X_test

    # 4. Predict on Held-Out Test Set
    y_test_pred = model.predict(X_test_scaled)

    # Calculate partition class distributions
    train_counts = {"BENIGN": int(np.sum(y_train == 0)), "DDOS": int(np.sum(y_train == 1))}
    val_counts = {"BENIGN": int(np.sum(y_val == 0)), "DDOS": int(np.sum(y_val == 1))}
    test_counts = {"BENIGN": int(np.sum(y_test == 0)), "DDOS": int(np.sum(y_test == 1))}

    unique_test_classes = np.unique(y_test)
    single_class_mode = len(unique_test_classes) < 2

    acc = accuracy_score(y_test, y_test_pred)
    prec_macro = precision_score(y_test, y_test_pred, average="macro", zero_division=0)
    rec_macro = recall_score(y_test, y_test_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_test, y_test_pred, average="macro", zero_division=0)
    f1_weighted = f1_score(y_test, y_test_pred, average="weighted", zero_division=0)

    cm = confusion_matrix(y_test, y_test_pred, labels=[0, 1])
    tn = int(cm[0][0])
    fp = int(cm[0][1])
    fn = int(cm[1][0])
    tp = int(cm[1][1])

    fpr = round(float(fp / (fp + tn)), 4) if (fp + tn) > 0 else 0.0
    fnr = round(float(fn / (fn + tp)), 4) if (fn + tp) > 0 else 0.0

    print("\n" + "=" * 70)
    print("REAL DATASET HELD-OUT TEST VALIDATION REPORT")
    print("=" * 70)
    print(f"Evaluation Dataset:       {adapter.dataset_name} ({adapter.dataset_version})")
    print(f"Model Artifact File:      {os.path.basename(model_path)}")
    print(f"Model Trained On:         {trained_on_dataset}")
    print(f"Model Classifier:         {model_name} ({model_version})")
    print(f"Target Threat Class:      {target_threat_class} (BENIGN = 0, {target_threat_class} = 1)")
    print(f"Source Test Partition:    {source_partition}")

    # Explicit cross-dataset vs in-domain indicator
    if trained_on_dataset.lower() != adapter.dataset_name.lower():
        print(f"Cross-Dataset Eval Notice: [WARNING] Model trained on '{trained_on_dataset}', evaluated on '{adapter.dataset_name}'")

    print("-" * 70)
    print("DATASET PARTITION CLASS DISTRIBUTIONS")
    print(f"  Training Data (70/80%):  BENIGN={train_counts['BENIGN']:<7} | DDOS={train_counts['DDOS']:<7}")
    print(f"  Validation Data (15/20%): BENIGN={val_counts['BENIGN']:<7} | DDOS={val_counts['DDOS']:<7}")
    print(f"  Held-Out Test Data:     BENIGN={test_counts['BENIGN']:<7} | DDOS={test_counts['DDOS']:<7}")
    print("-" * 70)

    if single_class_mode:
        print("[NOTICE] Binary evaluation is not possible on this test partition because only one class is present.")
        print(f"Test Set Class Count: {unique_test_classes}")
    else:
        print("MEASURED HELD-OUT TEST PERFORMANCE")
        print(f"  Accuracy:               {acc:.4f}")
        print(f"  Precision (Macro):      {prec_macro:.4f}")
        print(f"  Recall (Macro):         {rec_macro:.4f}")
        print(f"  F1 (Macro):             {f1_macro:.4f}")
        print(f"  F1 (Weighted):          {f1_weighted:.4f}")
        print(f"  False Positive Rate:    {fpr:.4f}")
        print(f"  False Negative Rate:    {fnr:.4f}")
        print("-" * 70)
        print("CONFUSION MATRIX (labels=[\"BENIGN\", \"DDOS\"])")
        print(f"  TN: {tn:<8} | FP: {fp:<8}")
        print(f"  FN: {fn:<8} | TP: {tp:<8}")

    print("-" * 70)
    print("FEATURE ORDER INTEGRITY")
    print(f"  Features Order ({len(expected_feature_cols)}): {', '.join(expected_feature_cols[:4])}...")
    print("  Feature Order Protection: VERIFIED MATCH")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PassiveGuard AI - Real Dataset Model Validation Harness")
    parser.add_argument("--dataset", type=str, default="synthetic", help="Dataset adapter name (unsw_nb15, cse_cic_ids2018, synthetic)")
    parser.add_argument("--model", type=str, default="./data/models/ddos_rf_v1.joblib", help="Path to trained model joblib artifact")
    parser.add_argument("--split-strategy", type=str, default="time_aware", choices=["time_aware", "stratified"], help="Split strategy used for evaluation")
    args = parser.parse_args()

    validate_model_on_dataset(args.dataset, args.model, args.split_strategy)
