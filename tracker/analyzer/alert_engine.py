"""Motor de alertas: evalúa snapshots y combos contra baseline y umbrales absolutos."""

import logging
from datetime import date

import pandas as pd

from tracker.analyzer.baseline import compute_baseline, should_alert

logger = logging.getLogger(__name__)


def process_route_alerts(
    route: dict,
    offers: list[dict],
    snapshot_ids: list[int],
    history_df: pd.DataFrame,
    today: date,
    cfg: dict,
) -> list[dict]:
    """Evalúa las ofertas del día y genera alertas si corresponde.

    Args:
        route: Diccionario de la ruta (id, origin, destination, absolute_threshold, etc.).
        offers: Lista de ofertas normalizadas del día (de Amadeus o SerpApi).
        snapshot_ids: IDs de los snapshots insertados en BD (misma longitud que offers).
        history_df: DataFrame con historial de precios para la ruta.
        today: Fecha de hoy para el cálculo de ventana.
        cfg: Configuración general (routes.yaml defaults).

    Returns:
        Lista de dicts con los campos necesarios para `SupabaseClient.insert_alert`.
        Cada dict tiene: route_id, snapshot_id, kind, price, baseline.
    """
    if not offers:
        logger.info(
            "process_route_alerts: sin ofertas para ruta=%s", route.get("id")
        )
        return []

    route_id: str = route["id"]
    absolute_threshold: float | None = route.get("absolute_threshold")

    # Determinar el mes de viaje a partir de la fecha de salida del vuelo más barato
    cheapest_offer = min(offers, key=lambda o: o["price_usd"])
    cheapest_idx = offers.index(cheapest_offer)
    cheapest_snapshot_id = snapshot_ids[cheapest_idx] if snapshot_ids else None

    dep_date_str: str = cheapest_offer.get("departure_date", "")
    try:
        travel_month = int(dep_date_str[5:7]) if dep_date_str else today.month
    except (ValueError, IndexError):
        travel_month = today.month

    # Calcular baseline con la ventana de 90 días segmentada por mes de viaje
    baseline = compute_baseline(history_df, route_id, travel_month, today)
    current_price: float = cheapest_offer["price_usd"]

    alert, kind = should_alert(current_price, baseline, absolute_threshold)

    if not alert:
        logger.info(
            "process_route_alerts: sin alerta para ruta=%s precio=%.2f kind=%s",
            route_id,
            current_price,
            kind,
        )
        return []

    logger.info(
        "process_route_alerts: ALERTA tipo=%s precio=%.2f ruta=%s",
        kind,
        current_price,
        route_id,
    )

    return [
        {
            "route_id": route_id,
            "snapshot_id": cheapest_snapshot_id,
            "kind": kind,
            "price": current_price,
            "baseline": baseline,
        }
    ]
