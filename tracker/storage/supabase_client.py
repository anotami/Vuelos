"""Cliente Supabase: inserts y queries para snapshots, alertas y combos."""

import logging
from datetime import date, datetime
from typing import Any

import pandas as pd
from supabase import create_client, Client

from tracker.config import Settings

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Abstracción sobre Supabase para todas las operaciones del tracker."""

    def __init__(self):
        self._client: Client = create_client(
            Settings.SUPABASE_URL,
            Settings.SUPABASE_SERVICE_KEY,
        )
        logger.info("SupabaseClient conectado a %s", Settings.SUPABASE_URL)

    # ------------------------------------------------------------------
    # Rutas
    # ------------------------------------------------------------------

    def get_enabled_routes(self) -> list[dict]:
        """Devuelve todas las rutas habilitadas de la tabla `routes`."""
        response = (
            self._client.table("routes")
            .select("*")
            .eq("enabled", True)
            .execute()
        )
        routes = response.data or []
        logger.info("get_enabled_routes: %d rutas activas", len(routes))
        return routes

    def get_route_by_id(self, route_id: str) -> dict | None:
        """Devuelve una ruta por su UUID, o None si no existe."""
        response = (
            self._client.table("routes")
            .select("*")
            .eq("id", route_id)
            .limit(1)
            .execute()
        )
        data = response.data or []
        if not data:
            logger.warning("get_route_by_id: ruta %s no encontrada", route_id)
            return None
        return data[0]

    # ------------------------------------------------------------------
    # Historial / Snapshots
    # ------------------------------------------------------------------

    def get_route_history(self, route_id: str, travel_month: int) -> pd.DataFrame:
        """Devuelve historial de snapshots para una ruta y mes de viaje.

        Returns:
            DataFrame con columnas: route_id, search_date (date),
            departure_date (datetime), price_usd (float).
        """
        response = (
            self._client.table("price_snapshots")
            .select("route_id, search_date, departure_date, price_usd")
            .eq("route_id", route_id)
            .execute()
        )
        rows = response.data or []

        if not rows:
            logger.info(
                "get_route_history: sin datos para ruta=%s mes=%d",
                route_id,
                travel_month,
            )
            return pd.DataFrame(
                columns=["route_id", "search_date", "departure_date", "price_usd"]
            )

        df = pd.DataFrame(rows)
        df["search_date"] = pd.to_datetime(df["search_date"]).dt.date
        df["departure_date"] = pd.to_datetime(df["departure_date"])
        df["price_usd"] = df["price_usd"].astype(float)

        logger.info(
            "get_route_history: %d filas para ruta=%s", len(df), route_id
        )
        return df

    def insert_snapshots(
        self,
        route_id: str,
        offers: list[dict],
        dep: date,
        ret: date | None,
    ) -> list[int]:
        """Inserta una lista de ofertas en `price_snapshots`.

        Returns:
            Lista de IDs (bigint) de las filas insertadas.
        """
        today_str = date.today().isoformat()
        rows = []
        for offer in offers:
            row: dict[str, Any] = {
                "route_id": route_id,
                "search_date": today_str,
                "departure_date": str(dep),
                "return_date": str(ret) if ret else None,
                "price_usd": float(offer["price_usd"]),
                "currency": "USD",
                "airline": offer.get("airline"),
                "stops": offer.get("stops", 0),
                "duration_minutes": offer.get("duration_minutes"),
                "booking_link": offer.get("booking_link"),
                "raw_data": offer.get("raw_data"),
                "source": offer.get("source", "unknown"),
                "is_separate_tickets": False,
            }
            rows.append(row)

        if not rows:
            logger.warning("insert_snapshots: lista de ofertas vacía para ruta=%s", route_id)
            return []

        response = (
            self._client.table("price_snapshots")
            .insert(rows)
            .execute()
        )
        inserted = response.data or []
        ids = [r["id"] for r in inserted]
        logger.info(
            "insert_snapshots: %d snapshots insertados para ruta=%s", len(ids), route_id
        )
        return ids

    # ------------------------------------------------------------------
    # Alertas
    # ------------------------------------------------------------------

    def insert_alert(
        self,
        route_id: str,
        snapshot_id: int,
        kind: str,
        price: float,
        baseline: dict,
    ) -> None:
        """Inserta una alerta en la tabla `alerts`.

        Calcula discount_pct y severity antes de insertar.
        severity: 'high' si >40%, 'medium' si >25%, 'low' si <=25%.
        """
        baseline_p25: float | None = baseline.get("baseline")

        discount_pct: float | None = None
        if baseline_p25 and baseline_p25 > 0:
            discount_pct = (baseline_p25 - price) / baseline_p25 * 100

        if discount_pct is not None:
            if discount_pct > 40:
                severity = "high"
            elif discount_pct > 25:
                severity = "medium"
            else:
                severity = "low"
        else:
            severity = "medium"

        row: dict[str, Any] = {
            "route_id": route_id,
            "snapshot_id": snapshot_id,
            "combo_id": None,
            "alert_type": kind,
            "triggered_price": price,
            "baseline_p25": baseline_p25,
            "discount_pct": discount_pct,
            "severity": severity,
            "is_dismissed": False,
            "is_archived": False,
        }

        self._client.table("alerts").insert(row).execute()
        logger.info(
            "insert_alert: tipo=%s precio=%.2f descuento=%.1f%% severidad=%s ruta=%s",
            kind,
            price,
            discount_pct or 0,
            severity,
            route_id,
        )

    # ------------------------------------------------------------------
    # Multi-stop combos
    # ------------------------------------------------------------------

    def log_api_call(self, origin: str, destination: str, provider: str, success: bool = True) -> None:
        """Registra una llamada a la API de vuelos para monitorear el uso de créditos."""
        try:
            self._client.table("serpapi_call_log").insert({
                "origin": origin,
                "destination": destination,
                "provider": provider,
                "success": success,
            }).execute()
        except Exception as exc:
            logger.warning("No se pudo registrar llamada API (%s): %s", provider, exc)

    def insert_multi_stop_combos(
        self,
        route_id: str,
        combos: list[dict],
        dep: date,
    ) -> None:
        """Inserta combinaciones multi-stop en `multi_stop_combos`."""
        if not combos:
            return

        today_str = date.today().isoformat()
        rows = []
        for combo in combos:
            leg1 = combo.get("leg1", {})
            leg2 = combo.get("leg2", {})
            row: dict[str, Any] = {
                "route_id": route_id,
                "search_date": today_str,
                "departure_date": str(dep),
                "hub": combo.get("hub"),
                "leg1_price": float(leg1.get("price_usd", 0)),
                "leg2_price": float(leg2.get("price_usd", 0)),
                "total_price": float(combo.get("total_price", 0)),
                "direct_price": float(combo.get("direct_price", 0)) if combo.get("direct_price") else None,
                "savings_pct": float(combo.get("savings_pct", 0)),
                "layover_hours": float(combo.get("layover_hours", 0)),
                "leg1_airline": leg1.get("airline"),
                "leg2_airline": leg2.get("airline"),
                "warnings": combo.get("warnings", []),
            }
            rows.append(row)

        self._client.table("multi_stop_combos").insert(rows).execute()
        logger.info(
            "insert_multi_stop_combos: %d combos insertados para ruta=%s", len(rows), route_id
        )
