from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
import pickle
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os

app = FastAPI(title="HerCycle AI ML Service")

# Load models on startup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PCOD_MODEL_PATH = os.path.join(BASE_DIR, "data", "pcod_model.pkl")
CYCLE_MODEL_PATH = os.path.join(BASE_DIR, "data", "cycle_model.pkl")

pcod_model = None
cycle_model = None

if os.path.exists(PCOD_MODEL_PATH):
    with open(PCOD_MODEL_PATH, "rb") as f:
        pcod_model = pickle.load(f)

if os.path.exists(CYCLE_MODEL_PATH):
    with open(CYCLE_MODEL_PATH, "rb") as f:
        cycle_model = pickle.load(f)

class CycleEntry(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    cycle_length: Optional[int] = None

class PredictCycleRequest(BaseModel):
    cycle_history: List[CycleEntry]
    today: str

class PcodRiskRequest(BaseModel):
    cycle_history: List[CycleEntry]
    symptoms: List[Any]

def parse_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str.split('T')[0], "%Y-%m-%d")
    except ValueError:
        return datetime.strptime(date_str.split(' ')[0], "%Y-%m-%d")

@app.post("/predict-cycle")
def predict_cycle(req: PredictCycleRequest):
    if not req.cycle_history:
        return {
            "prediction": {
                "nextPeriodDate": (datetime.now() + timedelta(days=28)).strftime("%b %d, %Y"),
                "confidence": "0%",
                "averageCycleLength": 28
            }
        }

    # Sort cycle history by start date ascending
    sorted_history = []
    for c in req.cycle_history:
        try:
            d = parse_date(c.start_date)
            sorted_history.append((d, c.cycle_length))
        except Exception:
            continue
            
    sorted_history.sort(key=lambda x: x[0])
    
    if not sorted_history:
        return {
            "prediction": {
                "nextPeriodDate": (datetime.now() + timedelta(days=28)).strftime("%b %d, %Y"),
                "confidence": "0%",
                "averageCycleLength": 28
            }
        }

    # Deduplicate: if less than 20 days apart, keep only the first one
    deduped = [sorted_history[0]]
    for item in sorted_history[1:]:
        gap = (item[0] - deduped[-1][0]).days
        if gap >= 20:
            deduped.append(item)

    today = parse_date(req.today)

    if len(deduped) < 2:
        # Fallback logic for single entry
        avg_len = deduped[0][1] if deduped[0][1] is not None else 28
        if avg_len < 21 or avg_len > 45:
            avg_len = 28
        last_logged = deduped[0][0]
        # Project forward
        next_period = last_logged + timedelta(days=avg_len)
        while next_period < today:
            next_period += timedelta(days=avg_len)
        
        missed = max(0, (today - (last_logged + timedelta(days=avg_len))).days // avg_len)
        confidence = max(20, 75 - missed * 12)
        
        return {
            "prediction": {
                "nextPeriodDate": next_period.strftime("%b %d, %Y"),
                "confidence": f"{confidence}%",
                "averageCycleLength": avg_len,
                "missedCycles": missed,
                "isStale": missed > 0,
                "hasEnoughRecentData": missed < 3,
                "lastLoggedDate": last_logged.strftime("%Y-%m-%d")
            }
        }

    # Calculate gap lengths
    gaps = []
    for i in range(1, len(deduped)):
        gaps.append((deduped[i][0] - deduped[i-1][0]).days)

    # Filter outliers
    med = np.median(gaps)
    std = np.std(gaps)
    filtered_gaps = gaps
    if len(gaps) >= 3 and std > 0:
        filtered_gaps = [g for g in gaps if abs(g - med) <= 2.5 * std]
        if len(filtered_gaps) < 2:
            filtered_gaps = gaps

    last_gap = filtered_gaps[-1]
    avg_gap = np.mean(filtered_gaps)
    std_gap = np.std(filtered_gaps) if len(filtered_gaps) >= 2 else 0.0

    # Model prediction
    predicted_length = 28
    if cycle_model is not None:
        try:
            features = pd.DataFrame([{
                'last_cycle_length': last_gap,
                'avg_past_length': avg_gap,
                'std_past_length': std_gap
            }])
            predicted_length = int(round(cycle_model.predict(features)[0]))
        except Exception:
            predicted_length = int(round(avg_gap))
    else:
        predicted_length = int(round(avg_gap))

    predicted_length = max(21, min(45, predicted_length))

    last_logged = deduped[-1][0]
    next_period = last_logged + timedelta(days=predicted_length)
    while next_period < today:
        next_period += timedelta(days=predicted_length)

    missed = max(0, (today - (last_logged + timedelta(days=predicted_length))).days // predicted_length)
    
    # Regularity confidence
    avg_var = np.mean([abs(g - predicted_length) for g in filtered_gaps])
    regularity = max(60, min(95, 95 - avg_var * 2))
    confidence = max(20, regularity - missed * 12)

    is_irregular = len(filtered_gaps) >= 2 and std_gap > 5

    prediction_window = None
    if is_irregular:
        window_from = next_period - timedelta(days=int(round(std_gap)))
        window_to = next_period + timedelta(days=int(round(std_gap)))
        prediction_window = {
            "from": window_from.strftime("%b %d, %Y"),
            "to": window_to.strftime("%b %d, %Y")
        }

    return {
        "prediction": {
            "nextPeriodDate": next_period.strftime("%b %d, %Y"),
            "confidence": f"{int(round(confidence))}%",
            "averageCycleLength": predicted_length,
            "missedCycles": missed,
            "isStale": missed > 0,
            "hasEnoughRecentData": missed < 3,
            "lastLoggedDate": last_logged.strftime("%Y-%m-%d"),
            "isIrregular": is_irregular,
            "regularityLabel": "Irregular Cycle" if is_irregular else "Regular Cycle",
            "varianceStdDev": round(std_gap, 1),
            "predictionWindow": prediction_window
        }
    }

@app.post("/pcod-risk")
def pcod_risk(req: PcodRiskRequest):
    if not req.cycle_history:
        return {
            "risk": {
                "score": 0,
                "tier": "LOW RISK",
                "factors": [],
                "recommendation": "Keep tracking your cycle and maintaining healthy habits."
            }
        }

    sorted_history = []
    for c in req.cycle_history:
        try:
            d = parse_date(c.start_date)
            sorted_history.append((d, c.cycle_length))
        except Exception:
            continue
    sorted_history.sort(key=lambda x: x[0])

    # Deduplicate
    deduped = []
    if sorted_history:
        deduped = [sorted_history[0]]
        for item in sorted_history[1:]:
            gap = (item[0] - deduped[-1][0]).days
            if gap >= 20:
                deduped.append(item)

    avg_len = 28.0
    std_len = 0.0
    if len(deduped) >= 3:
        gaps = []
        for i in range(1, len(deduped)):
            gaps.append((deduped[i][0] - deduped[i-1][0]).days)
        avg_len = float(np.mean(gaps))
        std_len = float(np.std(gaps))

    # Parse symptoms
    symptoms_flat = []
    for s in req.symptoms:
        if not s:
            continue
        if isinstance(s, str):
            symptoms_flat.append(s.lower().strip())
        elif isinstance(s, dict):
            if "symptoms" in s and isinstance(s["symptoms"], list):
                for sym in s["symptoms"]:
                    if isinstance(sym, str):
                        symptoms_flat.append(sym.lower().strip())
            else:
                s_name = s.get("symptom") or s.get("name")
                if s_name and isinstance(s_name, str):
                    symptoms_flat.append(s_name.lower().strip())

    has_acne = 1 if "acne" in symptoms_flat else 0
    has_hirsutism = 1 if "hirsutism" in symptoms_flat else 0
    has_weight_gain = 1 if "weight gain" in symptoms_flat else 0
    has_hair_loss = 1 if "hair loss" in symptoms_flat else 0

    # Model prediction
    pcod_class = 0 # Default: Low Risk
    if pcod_model is not None:
        try:
            features = pd.DataFrame([{
                'avg_cycle_length': avg_len,
                'std_cycle_length': std_len,
                'has_acne': has_acne,
                'has_hirsutism': has_hirsutism,
                'has_weight_gain': has_weight_gain,
                'has_hair_loss': has_hair_loss
            }])
            pcod_class = int(pcod_model.predict(features)[0])
            probs = pcod_model.predict_proba(features)[0]
        except Exception:
            pcod_class = 0
            probs = [1.0, 0.0, 0.0]
    else:
        # Fallback simple logic
        probs = [0.8, 0.15, 0.05]

    # Map class to score & tier
    if pcod_class == 2:
        tier = "HIGH RISK"
        score = int(round(probs[2] * 100)) if pcod_model is not None else 65
        score = max(55, score)
    elif pcod_class == 1:
        tier = "MEDIUM RISK"
        score = int(round(probs[1] * 100)) if pcod_model is not None else 40
        score = max(30, min(54, score))
    else:
        tier = "LOW RISK"
        score = int(round((1 - probs[0]) * 100)) if pcod_model is not None else 15
        score = min(29, score)

    # Extract risk factors
    factors = []
    if std_len > 7:
        factors.append("Irregular cycle patterns detected")
    if avg_len < 21 or avg_len > 35:
        factors.append("Cycle length outside normal range")
    if has_acne:
        factors.append("Mild hormonal symptom noted (acne)")
    if has_hirsutism:
        factors.append("Persistent recurrence of PCOD-related symptoms (hirsutism)")
    if has_weight_gain:
        factors.append("Persistent recurrence of PCOD-related symptoms (weight gain)")
    if has_hair_loss:
        factors.append("Persistent recurrence of PCOD-related symptoms (hair loss)")

    if tier == "LOW RISK" and not factors:
        factors = ["Regular cycle length maintained", "No significant hormonal symptoms"]

    return {
        "risk": {
            "score": score,
            "tier": tier,
            "factors": factors,
            "recommendation": "Consider consulting with a healthcare provider for detailed assessment." if tier == "HIGH RISK" else "Keep tracking your cycle and maintaining healthy habits."
        }
    }
