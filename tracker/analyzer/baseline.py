"""Cálculo de baseline P25 con ventana móvil + EMA + segmentación por mes-viaje.

Reglas críticas:
- P25 ventana 90d agrupado por (route_id, mes_de_viaje)
- Cold start: si n < 30 → fallback a absolute_threshold de la ruta
- Alerta cuando: current < 0.70 * P25 AND current < EMA AND n >= 30
- EMA con alpha=0.15 (smoothing alto, poca reactividad a outliers)
"""

import pandas as pd
import numpy as np
from datetime import date, timedelta


def compute_baseline(
    snapshots_df: pd.DataFrame, route_id: str, travel_month: int, today: date
) -> dict:
    cutoff = today - timedelta(days=90)
    mask = (
        (snapshots_df["route_id"] == route_id)
        & (snapshots_df["search_date"] >= cutoff)
        & (snapshots_df["departure_date"].dt.month == travel_month)
    )
    window = snapshots_df.loc[mask, "price_usd"]
    n = len(window)
    if n < 30:
        return {"baseline": None, "n": n, "cold_start": True}

    p25 = float(np.percentile(window, 25))
    ema = window.ewm(alpha=0.15).mean().iloc[-1]
    return {"baseline": p25, "ema": float(ema), "n": n, "cold_start": False}


def should_alert(
    current: float, baseline: dict, absolute_threshold: float | None
) -> tuple[bool, str]:
    if baseline.get("cold_start"):
        if absolute_threshold and current <= absolute_threshold:
            return True, "absolute"
        return False, "cold_start"

    p25 = baseline["baseline"]
    ema = baseline["ema"]
    if current < 0.70 * p25 and current < ema:
        return True, "baseline"
    return False, "no_alert"
