"""
PassiveGuard AI — Model Training, Evaluation & Artifact Generation Engine (Module 16)

STRICT PASSIVE & HONEST METRICS DIRECTIVE:
Executes reproducible model training (RandomForest, HistGradientBoosting) and computes actual measured test metrics.
Under NO circumstances does it report fabricated accuracy or F1 scores.
Persists model binary artifacts (.joblib) and training manifests (.json).
"""
import os
import json
import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

from app.ml.datasets import DatasetAdapterRegistry, PASSIVEGUARD_FEATURE_SCHEMA
from app.ml.preprocessing import DataPreprocessor, DataManifest, LabelMapper

logger = logging.getLogger(__name__)


class ModelTrainer:
    """
    Reproducible ML Trainer and Evaluator.
    Trains scikit-learn models, computes actual test set metrics, and persists artifacts.
    """

    def __init__(self, random_seed: int = 42):
        self.random_seed = random_seed
        self.preprocessor = DataPreprocessor(random_seed=random_seed)

    def train_and_evaluate(
        self,
        dataset_name: str = "synthetic",
        target_threat_class: str = "DDOS",
        model_type: str = "rf",
        split_strategy: str = "time_aware",
        imbalance_strategy: str = "balanced_weights",
        data_dir: Optional[str] = None,
        out_dir: str = "data/models",
        manifest_dir: str = "data/manifests",
        data_path: Optional[str] = None
    ) -> Tuple[Any, DataManifest]:
        """
        Loads dataset using adapter, pre-processes, splits (Train/Val/Test), trains classifier,
        computes actual metrics, and saves joblib model artifact and JSON manifest.
        """
        if data_path is not None:
            dataset_name = data_path

        start_total = time.time()
        os.makedirs(out_dir, exist_ok=True)
        os.makedirs(manifest_dir, exist_ok=True)

        # 1. Obtain Dataset Adapter from Registry
        adapter = DatasetAdapterRegistry.get_adapter(dataset_name, data_dir=data_dir)
        local_files = adapter.discover_local_files()

        # Handle missing real dataset file gracefully
        if not local_files and dataset_name.lower() not in ["synthetic", "synthetic_fixture", "demo"]:
            logger.warning(f"REAL DATASET '{adapter.dataset_name}' NOT FOUND under local data directory.")
            print("\n" + "=" * 70)
            print(f"REAL DATASET ({adapter.dataset_name}): NOT AVAILABLE")
            print("STATUS: Training skipped because local dataset CSV files were not found.")
            print(f"EXPECTED LOCATION: Place CSV files under data/raw/{dataset_name.lower()}/")
            print("SYNTHETIC FIXTURE: Available only for pipeline testing.")
            print("=" * 70 + "\n")
            raise FileNotFoundError(f"Real dataset '{adapter.dataset_name}' CSV files not found. Place dataset files in data/raw/{dataset_name.lower()}/")

        feature_cols = PASSIVEGUARD_FEATURE_SCHEMA
        label_col = "mapped_label"

        # 2. Check if Dataset Adapter has Predefined Splits (e.g. UNSW_NB15_training-set.csv and UNSW_NB15_testing-set.csv)
        if adapter.has_predefined_splits:
            start_load = time.time()
            raw_train_df, raw_test_df = adapter.load_splits()
            load_time = round(time.time() - start_load, 4)

            start_prep = time.time()
            df_train_filt, label_counts_train = adapter.map_labels(raw_train_df, target_threat_class=target_threat_class)
            df_train_feat, feature_availability = adapter.map_features(df_train_filt)

            df_test_filt, label_counts_test = adapter.map_labels(raw_test_df, target_threat_class=target_threat_class)
            df_test_feat, _ = adapter.map_features(df_test_filt)

            label_counts = {
                "BENIGN": label_counts_train.get("BENIGN", 0) + label_counts_test.get("BENIGN", 0),
                target_threat_class: label_counts_train.get(target_threat_class, 0) + label_counts_test.get(target_threat_class, 0),
                "EXCLUDED": label_counts_train.get("EXCLUDED", 0) + label_counts_test.get("EXCLUDED", 0)
            }

            X_train, X_val, X_test, y_train, y_val, y_test, scaler, audit = self.preprocessor.prepare_predefined_dataset(
                df_train_feat,
                df_test_feat,
                feature_cols=feature_cols,
                label_col=label_col,
                target_threat_class=target_threat_class,
                imbalance_strategy=imbalance_strategy
            )
            split_strategy = "predefined_official_split"
            prep_time = round(time.time() - start_prep, 4)
        else:
            # 2b. Load Raw DataFrame & Perform Mapping for Custom/Synthetic Datasets
            start_load = time.time()
            raw_df = adapter.load()
            load_time = round(time.time() - start_load, 4)

            start_prep = time.time()
            df_filtered, label_counts = adapter.map_labels(raw_df, target_threat_class=target_threat_class)
            df_features, feature_availability = adapter.map_features(df_filtered)

            X_train, X_val, X_test, y_train, y_val, y_test, scaler, audit = self.preprocessor.prepare_dataset(
                df_features,
                feature_cols=feature_cols,
                label_col=label_col,
                target_threat_class=target_threat_class,
                split_strategy=split_strategy,
                imbalance_strategy=imbalance_strategy
            )
            prep_time = round(time.time() - start_prep, 4)

        # Log Class Distribution of all three partitions
        logger.info(f"CLASS DISTRIBUTION - Training Set:   BENIGN={int(np.sum(y_train == 0))}, {target_threat_class}={int(np.sum(y_train == 1))}")
        logger.info(f"CLASS DISTRIBUTION - Validation Set: BENIGN={int(np.sum(y_val == 0))}, {target_threat_class}={int(np.sum(y_val == 1))}")
        logger.info(f"CLASS DISTRIBUTION - Test Set:       BENIGN={int(np.sum(y_test == 0))}, {target_threat_class}={int(np.sum(y_test == 1))}")

        # 4. Instantiate Classifier
        model_name = "RandomForestClassifier"
        class_weight_param = "balanced" if imbalance_strategy == "balanced_weights" else None

        if model_type.lower() in ["gb", "gradientboosting", "hist"]:
            clf = HistGradientBoostingClassifier(random_state=self.random_seed)
            model_name = "HistGradientBoostingClassifier"
        else:
            clf = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=self.random_seed,
                class_weight=class_weight_param
            )
            model_name = "RandomForestClassifier"

        # 5. Train Classifier on Train set ONLY
        start_train = time.time()
        logger.info(f"Training {model_name} on {len(X_train)} train samples using {split_strategy} split...")
        clf.fit(X_train, y_train)
        train_time = round(time.time() - start_train, 4)

        # 6. Evaluation on Train, Validation, and Test sets
        start_val = time.time()
        y_train_pred = clf.predict(X_train)
        f1_train = f1_score(y_train, y_train_pred, average="macro", zero_division=0)

        y_val_pred = clf.predict(X_val)
        f1_val = f1_score(y_val, y_val_pred, average="macro", zero_division=0)
        val_time = round(time.time() - start_val, 4)

        y_test_pred = clf.predict(X_test)

        acc = accuracy_score(y_test, y_test_pred)
        prec_macro = precision_score(y_test, y_test_pred, average="macro", zero_division=0)
        rec_macro = recall_score(y_test, y_test_pred, average="macro", zero_division=0)
        f1_macro = f1_score(y_test, y_test_pred, average="macro", zero_division=0)
        f1_weighted = f1_score(y_test, y_test_pred, average="weighted", zero_division=0)

        # Numerical Confusion Matrix & FPR/FNR Calculation with explicit labels=[0, 1]
        unique_test_classes = np.unique(y_test)
        if len(unique_test_classes) < 2:
            logger.warning(f"Held-out test partition contains only 1 class ({unique_test_classes}). Full binary evaluation (TN, FP, FN, TP) cannot be reliably computed.")

        cm = confusion_matrix(y_test, y_test_pred, labels=[0, 1])
        cm_list = cm.tolist()

        tn = int(cm[0][0])
        fp = int(cm[0][1])
        fn = int(cm[1][0])
        tp = int(cm[1][1])

        fpr = round(float(fp / (fp + tn)), 4) if (fp + tn) > 0 else 0.0
        fnr = round(float(fn / (fn + tp)), 4) if (fn + tp) > 0 else 0.0

        # Feature Importances for explainability
        feature_importances: Dict[str, float] = {}
        if hasattr(clf, "feature_importances_"):
            importances = clf.feature_importances_
            for name, imp in zip(feature_cols, importances):
                feature_importances[name] = round(float(imp), 4)

        overfit_gap = round(float(f1_train - f1_macro), 4)

        metrics = {
            "accuracy": round(float(acc), 4),
            "precision_macro": round(float(prec_macro), 4),
            "recall_macro": round(float(rec_macro), 4),
            "f1_macro": round(float(f1_macro), 4),
            "f1_weighted": round(float(f1_weighted), 4),
            "false_positive_rate": fpr,
            "false_negative_rate": fnr,
            "confusion_matrix_summary": {"TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp)}
        }

        # 7. Construct Provenance DataManifest
        total_eval_samples = (len(df_train_feat) + len(df_test_feat)) if adapter.has_predefined_splits else len(df_features)

        manifest = DataManifest(
            dataset_name=adapter.dataset_name,
            source=adapter.source_description,
            version=adapter.dataset_version,
            dataset_files=[os.path.basename(f) for f in local_files],
            is_local_file=True,
            total_samples=total_eval_samples,
            cleaned_samples=len(X_train) + len(X_val) + len(X_test),
            rows_dropped=audit.get("rows_dropped", 0),
            sample_counts={"total": total_eval_samples, "train": len(X_train), "validation": len(X_val), "test": len(X_test)},
            feature_count=len(feature_cols),
            feature_names=feature_cols,
            feature_availability=feature_availability,
            label_mapping=label_counts,
            split_strategy=split_strategy,
            imbalance_strategy=imbalance_strategy,
            split_ratios={"train": 0.70, "validation": 0.15, "test": 0.15},
            random_seed=self.random_seed,
            class_distribution={"BENIGN": int(np.sum(y_test == 0)), target_threat_class: int(np.sum(y_test == 1))},
            cleaning_audit=audit,
            evaluation_metrics=metrics,
            confusion_matrix=cm_list,
            feature_importances=feature_importances,
            overfitting_check={"f1_train": round(float(f1_train), 4), "f1_test": round(float(f1_macro), 4), "overfitting_gap": overfit_gap}
        )

        # Persist model binary artifact (.joblib)
        model_filename = f"{target_threat_class.lower()}_{model_type.lower()}_{adapter.dataset_name.lower().replace('-', '_')}_v1.joblib"
        model_path = os.path.join(out_dir, model_filename)

        pipeline_artifact = {
            "model": clf,
            "scaler": scaler,
            "feature_cols": feature_cols,
            "feature_availability": feature_availability,
            "dataset_name": adapter.dataset_name,
            "target_threat_class": target_threat_class,
            "model_name": model_name,
            "model_version": f"{model_type.lower()}-v1.0"
        }
        joblib.dump(pipeline_artifact, model_path)
        logger.info(f"Saved model binary artifact to: {model_path}")

        # Always save ddos_rf_v1.joblib copy for DDOS RF models for pipeline backwards compatibility
        if target_threat_class.upper() == "DDOS" and model_type.lower() in ["rf", "randomforest"]:
            joblib.dump(pipeline_artifact, os.path.join(out_dir, "ddos_rf_v1.joblib"))

        # Persist model manifest JSON (.json)
        manifest_filename = f"{target_threat_class.lower()}_{model_type.lower()}_{adapter.dataset_name.lower().replace('-', '_')}_v1.json"
        manifest_path = os.path.join(manifest_dir, manifest_filename)

        with open(manifest_path, "w") as f:
            json.dump(manifest.model_dump(mode="json"), f, indent=2)

        if target_threat_class.upper() == "DDOS" and model_type.lower() in ["rf", "randomforest"]:
            with open(os.path.join(manifest_dir, "ddos_rf_v1.json"), "w") as f:
                json.dump(manifest.model_dump(mode="json"), f, indent=2)

        logger.info(f"Saved dataset training manifest JSON to: {manifest_path}")

        return clf, manifest
