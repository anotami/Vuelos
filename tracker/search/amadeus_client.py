"""Cliente Amadeus Self-Service API con retries via tenacity."""

import logging
from datetime import date
from typing import Any

from amadeus import Client, ResponseError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from tracker.config import Settings

logger = logging.getLogger(__name__)


def _parse_duration(iso_duration: str) -> int:
    """Convierte duración ISO 8601 (ej. PT2H30M) a minutos."""
    import re
    pattern = re.compile(r"PT(?:(\d+)H)?(?:(\d+)M)?")
    match = pattern.match(iso_duration)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    return hours * 60 + minutes


def _extract_offer(offer: dict) -> dict:
    """Extrae los campos relevantes de una oferta Amadeus."""
    itineraries = offer.get("itineraries", [])
    price = float(offer.get("price", {}).get("total", 0))

    # Itinerario de ida (primero)
    outbound = itineraries[0] if itineraries else {}
    segments = outbound.get("segments", [])

    airline = ""
    if segments:
        airline = segments[0].get("carrierCode", "")

    stops = max(len(segments) - 1, 0)

    duration_str = outbound.get("duration", "PT0M")
    duration_minutes = _parse_duration(duration_str)

    departure_iso = ""
    arrival_iso = ""
    if segments:
        departure_iso = segments[0].get("departure", {}).get("at", "")
        arrival_iso = segments[-1].get("arrival", {}).get("at", "")

    departure_date_str = departure_iso[:10] if departure_iso else ""

    # Fecha de vuelta si hay segundo itinerario
    return_date_str = None
    if len(itineraries) > 1:
        return_segments = itineraries[1].get("segments", [])
        if return_segments:
            return_date_str = return_segments[0].get("departure", {}).get("at", "")[:10]

    return {
        "price_usd": price,
        "airline": airline,
        "stops": stops,
        "duration_minutes": duration_minutes,
        "departure_date": departure_date_str,
        "return_date": return_date_str,
        "booking_link": None,
        "raw_data": offer,
        "source": "amadeus",
        "arrival_iso": arrival_iso,
        "departure_iso": departure_iso,
    }


class AmadeusClient:
    """Wrapper sobre la SDK oficial de Amadeus con reintentos automáticos."""

    def __init__(self):
        self.client = Client(
            client_id=Settings.AMADEUS_CLIENT_ID,
            client_secret=Settings.AMADEUS_CLIENT_SECRET,
            hostname=Settings.AMADEUS_HOSTNAME,
        )
        logger.info(
            "AmadeusClient inicializado (hostname=%s)", Settings.AMADEUS_HOSTNAME
        )

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
        """Busca vuelos usando la API Flight Offers Search de Amadeus.

        Args:
            origin: Código IATA de origen (ej. "LIM").
            destination: Código IATA de destino (ej. "MAD").
            departure_date: Fecha de salida (date o str ISO).
            return_date: Fecha de vuelta opcional (date o str ISO).
            max_results: Máximo de resultados a solicitar.

        Returns:
            Lista de diccionarios con datos normalizados de cada oferta.
        """
        dep_str = str(departure_date)[:10]

        params: dict[str, Any] = dict(
            originLocationCode=origin,
            destinationLocationCode=destination,
            departureDate=dep_str,
            adults=1,
            max=max_results,
            currencyCode="USD",
        )
        if return_date:
            params["returnDate"] = str(return_date)[:10]

        logger.info(
            "Amadeus search: %s→%s dep=%s ret=%s max=%d",
            origin,
            destination,
            dep_str,
            params.get("returnDate"),
            max_results,
        )

        try:
            response = self.client.shopping.flight_offers_search.get(**params)
            raw_offers = response.data or []
        except ResponseError as exc:
            logger.error(
                "Amadeus ResponseError %s→%s: %s", origin, destination, exc
            )
            raise

        results = []
        for offer in raw_offers:
            try:
                parsed = _extract_offer(offer)
                results.append(parsed)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error parseando oferta Amadeus: %s", exc)

        logger.info(
            "Amadeus devolvió %d ofertas para %s→%s", len(results), origin, destination
        )
        return results
