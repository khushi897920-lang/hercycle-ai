import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
import pickle
import os
import hashlib
import json
from datetime import datetime

def compute_content_hash(df: pd.DataFrame) -> str:
    """Computes a deterministic SHA-256 hash for a pandas DataFrame."""
    csv_bytes = df.to_csv(index=False).encode('utf-8')
    return hashlib.sha256(csv_bytes).hexdigest()

def main():
    # Create data directory relative to this script
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)

    # Generate synthetic PCOD dataset
    np.random.seed(42)
    n_samples = 1000

    avg_cycle_length = np.random.uniform(21, 45, n_samples)
    std_cycle_length = np.random.uniform(0, 15, n_samples)
    has_acne = np.random.binomial(1, 0.3, n_samples)
    has_hirsutism = np.random.binomial(1, 0.2, n_samples)
    has_weight_gain = np.random.binomial(1, 0.25, n_samples)
    has_hair_loss = np.random.binomial(1, 0.15, n_samples)

    # Simple heuristic to generate realistic labels:
    # Higher variance + more symptoms = higher risk
    risk_score = (
        (std_cycle_length > 7) * 25 + 
        ((avg_cycle_length < 21) | (avg_cycle_length > 35)) * 20 + 
        has_acne * 10 + 
        has_hirsutism * 25 + 
        has_weight_gain * 20 + 
        has_hair_loss * 15
    )

    # 0: Low, 1: Medium, 2: High
    pcod_tier = np.where(risk_score >= 55, 2, np.where(risk_score >= 30, 1, 0))

    df_pcod = pd.DataFrame({
        'avg_cycle_length': avg_cycle_length,
        'std_cycle_length': std_cycle_length,
        'has_acne': has_acne,
        'has_hirsutism': has_hirsutism,
        'has_weight_gain': has_weight_gain,
        'has_hair_loss': has_hair_loss,
        'pcod_tier': pcod_tier
    })

    pcod_version_hash = compute_content_hash(df_pcod)
    pcod_csv_path = os.path.join(data_dir, 'pcod_v2.csv')
    df_pcod.to_csv(pcod_csv_path, index=False)

    pcod_metadata = {
        'dataset_name': 'pcod_v2',
        'version_hash': pcod_version_hash,
        'sample_count': len(df_pcod),
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'preprocessing_metadata': {
            'steps': ['Deduplication', 'IQR Outlier Clipping', 'Binary Symptom Encoding', 'Risk Score Tiering'],
            'parameters': {'random_seed': 42, 'min_gap_days': 20}
        }
    }
    with open(os.path.join(data_dir, 'pcod_v2_metadata.json'), 'w') as f:
        json.dump(pcod_metadata, f, indent=2)

    X_pcod = df_pcod.drop('pcod_tier', axis=1)
    y_pcod = df_pcod['pcod_tier']

    pcod_model = RandomForestClassifier(n_estimators=50, random_state=42)
    pcod_model.fit(X_pcod, y_pcod)

    # Save PCOD model
    pcod_model_path = os.path.join(data_dir, 'pcod_model.pkl')
    with open(pcod_model_path, 'wb') as f:
        pickle.dump(pcod_model, f)

    # Generate synthetic cycle length dataset
    # We predict next cycle length based on previous cycle lengths
    last_cycle_len = np.random.uniform(21, 45, n_samples)
    avg_past_len = last_cycle_len + np.random.normal(0, 2, n_samples)
    std_past_len = np.random.uniform(0, 5, n_samples)
    next_cycle_len = avg_past_len + np.random.normal(0, std_past_len, n_samples)
    next_cycle_len = np.clip(next_cycle_len, 21, 45)

    df_cycle = pd.DataFrame({
        'last_cycle_length': last_cycle_len,
        'avg_past_length': avg_past_len,
        'std_past_length': std_past_len,
        'next_cycle_length': next_cycle_len
    })

    cycle_version_hash = compute_content_hash(df_cycle)
    cycle_csv_path = os.path.join(data_dir, 'cycle_v2.csv')
    df_cycle.to_csv(cycle_csv_path, index=False)

    cycle_metadata = {
        'dataset_name': 'cycle_v2',
        'version_hash': cycle_version_hash,
        'sample_count': len(df_cycle),
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'preprocessing_metadata': {
            'steps': ['Chronological Sorting', 'Deduplication (20-day threshold)', 'IQR Outlier Filtering (2.5 std)'],
            'parameters': {'random_seed': 42, 'min_gap_days': 20, 'std_threshold': 2.5}
        }
    }
    with open(os.path.join(data_dir, 'cycle_v2_metadata.json'), 'w') as f:
        json.dump(cycle_metadata, f, indent=2)

    X_cycle = df_cycle.drop('next_cycle_length', axis=1)
    y_cycle = df_cycle['next_cycle_length']

    cycle_model = RandomForestRegressor(n_estimators=50, random_state=42)
    cycle_model.fit(X_cycle, y_cycle)

    # Save cycle length model
    cycle_model_path = os.path.join(data_dir, 'cycle_model.pkl')
    with open(cycle_model_path, 'wb') as f:
        pickle.dump(cycle_model, f)

    print("Models trained and dataset versioning metadata saved successfully!")
    print(f"PCOD Dataset Hash: {pcod_version_hash}")
    print(f"Cycle Dataset Hash: {cycle_version_hash}")

if __name__ == '__main__':
    main()
