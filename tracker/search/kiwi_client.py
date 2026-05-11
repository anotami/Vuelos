"""Cliente Kiwi (Tequila) API con retries via tenacity."""

import logging
from typing import Any

import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from tracker.config import Settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.tequila.kiwi.com/v2/search"


def _extract_offer(itinerary: dict) -> dict:
    """Normaliza una oferta Kiwi al formato interno."""
    routes = itinerary.get("route", [])
    price = float(itinerary.get("price", 0))

    airline = routes[0].get("airline", "") if routes else ""
    departure_iso = itinerary.get("local_departure", "")
    arrival_iso = itinerary.get("local_arrival", "")
    duration_minutes = itinerary.get("duration", {}).get("departure", 0) // 60

    stops = max(len(routes) - 1, 0)
    departure_date_str = departure_iso[:10] if departure_iso else ""

    return_date_str = None
    return_routes = itinerary.get("route", [])
    if itinerary.get("return_duration"):
        return_routes_back = [r for r in return_routes if r.get("return") == 1]
        if return_routes_back:
            return_date_str = return_routes_back[0].get("local_departure", "")[:10]

    return {
        "price_usd": price,
        "airline": airline,
        "stops": stops,
        "duration_minutes": duration_minutes,
        "departure_date": departure_date_str,
        "return_date": return_date_str,
        "booking_link": itinerary.get("deep_link"),
        "raw_data": itinerary,
        "source": "kiwi",
        "arrival_iso": arrival_iso,
        "departure_iso": departure_iso,
    }


class KiwiClient:
    """Wrapper sobre la API Tequila de Kiwi.com con reintentos automáticos."""

    def __init__(self):
        self.api_key = Settings.KIWI_API_KEY
        if not self.api_key:
            raise ValueError("KIWI_API_KEY no configurado")
        logger.info("KiwiClient inicializado")

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def search(
        self,
        origin: str,
        destination: str,
        departure_date,
        return_date=None,
        max_results: int = 10,
        **kwargs: Any,
    ) -> list[dict]:
        dep_str = str(departure_date)[:10]

        params: dict[str, Any] = {
            "fly_from": origin,
            "fly_to": destination,
            "date_from": dep_str,
            "date_to": dep_str,
            "adults": 1,
            "limit": max_results,
            "curr": "USD",
            "sort": "price",
        }
        if return_date:
            ret_str = str(return_date)[:10]
            params["return_from"] = ret_str
            params["return_to"] = ret_str
            params["flight_type"] = "round"
        else:
            params["flight_type"] = "oneway"

        logger.info(
            "Kiwi search: %s→%s dep=%s ret=%s",
            origin, destination, dep_str, return_date,
        )

        resp = requests.get(
            _BASE_URL,
            params=params,
            headers={"apikey": self.api_key},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        for itinerary in data.get("data", [])[:max_results]:
            try:
                results.append(_extract_offer(itinerary))
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error parseando oferta Kiwi: %s", exc)

        logger.info(
            "Kiwi devolvió %d ofertas para %s→%s", len(results), origin, destination
        )
        return results
