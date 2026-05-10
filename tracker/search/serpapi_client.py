"""Cliente SerpApi Google Flights con retries via tenacity."""

import logging
from typing import Any

from serpapi import GoogleSearch
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from tracker.config import Settings

logger = logging.getLogger(__name__)


def _parse_duration_text(text: str) -> int:
    """Convierte texto de duración (ej. '2 hr 30 min') a minutos."""
    import re
    total = 0
    hr_match = re.search(r"(\d+)\s*hr", text)
    min_match = re.search(r"(\d+)\s*min", text)
    if hr_match:
        total += int(hr_match.group(1)) * 60
    if min_match:
        total += int(min_match.group(1))
    return total


def _extract_flight(flight_group: dict) -> dict:
    """Normaliza un grupo de vuelo de SerpApi al formato interno."""
    legs = flight_group.get("flights", [])
    price = float(flight_group.get("price", 0))

    airline = ""
    departure_iso = ""
    arrival_iso = ""
    duration_minutes = 0

    if legs:
        first_leg = legs[0]
        last_leg = legs[-1]
        airline = first_leg.get("airline", "")
        departure_iso = first_leg.get("departure_airport", {}).get("time", "")
        arrival_iso = last_leg.get("arrival_airport", {}).get("time", "")
        # SerpApi puede dar duración total del grupo
        raw_duration = flight_group.get("total_duration", 0)
        if isinstance(raw_duration, (int, float)):
            duration_minutes = int(raw_duration)
        elif isinstance(raw_duration, str):
            duration_minutes = _parse_duration_text(raw_duration)

    stops = max(len(legs) - 1, 0)
    departure_date_str = departure_iso[:10] if departure_iso else ""

    return {
        "price_usd": price,
        "airline": airline,
        "stops": stops,
        "duration_minutes": duration_minutes,
        "departure_date": departure_date_str,
        "return_date": None,
        "booking_link": flight_group.get("booking_token"),
        "raw_data": flight_group,
        "source": "serpapi",
        "arrival_iso": arrival_iso,
        "departure_iso": departure_iso,
    }


class SerpApiClient:
    """Wrapper sobre SerpApi Google Flights con reintentos automáticos."""

    def __init__(self):
        self.api_key = Settings.SERPAPI_KEY
        logger.info("SerpApiClient inicializado")

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
        """Busca vuelos usando SerpApi Google Flights.

        Args:
            origin: Código IATA de origen (ej. "LIM").
            destination: Código IATA de destino (ej. "MAD").
            departure_date: Fecha de salida (date o str ISO).
            return_date: Fecha de vuelta opcional (date o str ISO).
            max_results: Máximo de resultados a devolver.

        Returns:
            Lista de diccionarios con datos normalizados de cada oferta.
        """
        dep_str = str(departure_date)[:10]

        params: dict[str, Any] = {
            "engine": "google_flights",
            "departure_id": origin,
            "arrival_id": destination,
            "outbound_date": dep_str,
            "currency": "USD",
            "hl": "en",
            "api_key": self.api_key,
            "type": "1" if return_date else "2",  # 1=round-trip, 2=one-way
        }
        if return_date:
            params["return_date"] = str(return_date)[:10]

        logger.info(
            "SerpApi search: %s→%s dep=%s ret=%s",
            origin,
            destination,
            dep_str,
            params.get("return_date"),
        )

        try:
            search = GoogleSearch(params)
            result = search.get_dict()
        except Exception as exc:
            logger.error(
                "SerpApi error %s→%s: %s", origin, destination, exc
            )
            raise

        if "error" in result:
            logger.error("SerpApi API error: %s", result["error"])
            raise RuntimeError(f"SerpApi returned error: {result['error']}")

        raw_flights: list[dict] = []
        raw_flights.extend(result.get("best_flights", []))
        raw_flights.extend(result.get("other_flights", []))

        results = []
        for flight_group in raw_flights[:max_results]:
            try:
                parsed = _extract_flight(flight_group)
                results.append(parsed)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error parseando oferta SerpApi: %s", exc)

        logger.info(
            "SerpApi devolvió %d ofertas para %s→%s", len(results), origin, destination
        )
        return results
