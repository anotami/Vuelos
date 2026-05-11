"""Router multi-proveedor: intenta cada fuente en orden y usa la primera que funcione."""

import logging
from typing import Any

from tracker.config import Settings

logger = logging.getLogger(__name__)


def _build_providers() -> list[tuple[str, Any]]:
    """Instancia sólo los proveedores con credenciales configuradas."""
    providers = []

    if Settings.SERPAPI_KEY:
        try:
            from tracker.search.serpapi_client import SerpApiClient
            providers.append(("serpapi", SerpApiClient()))
            logger.info("Proveedor disponible: serpapi")
        except Exception as exc:
            logger.warning("No se pudo inicializar SerpApi: %s", exc)

    if Settings.AMADEUS_CLIENT_ID and Settings.AMADEUS_CLIENT_SECRET:
        try:
            from tracker.search.amadeus_client import AmadeusClient
            providers.append(("amadeus", AmadeusClient()))
            logger.info("Proveedor disponible: amadeus")
        except Exception as exc:
            logger.warning("No se pudo inicializar Amadeus: %s", exc)

    if Settings.KIWI_API_KEY:
        try:
            from tracker.search.kiwi_client import KiwiClient
            providers.append(("kiwi", KiwiClient()))
            logger.info("Proveedor disponible: kiwi")
        except Exception as exc:
            logger.warning("No se pudo inicializar Kiwi: %s", exc)

    if not providers:
        raise RuntimeError(
            "Ningún proveedor de vuelos configurado. "
            "Define al menos una de estas variables: SERPAPI_KEY, AMADEUS_CLIENT_ID, KIWI_API_KEY"
        )

    return providers


class FlightSearchRouter:
    """Intenta proveedores en orden (SerpApi → Amadeus → Kiwi) con fallback automático."""

    def __init__(self):
        self._providers = _build_providers()
        names = [n for n, _ in self._providers]
        logger.info("FlightSearchRouter listo con proveedores: %s", names)

    def search(
        self,
        origin: str,
        destination: str,
        departure_date,
        return_date=None,
        max_results: int = 10,
        **kwargs: Any,
    ) -> tuple[list[dict], str]:
        """Busca vuelos intentando cada proveedor en orden.

        Returns:
            (ofertas, nombre_proveedor) del primer proveedor que responde.
        """
        errors = []

        for name, client in self._providers:
            try:
                results = client.search(
                    origin, destination, departure_date, return_date,
                    max_results=max_results, **kwargs
                )
                logger.info("Proveedor '%s' respondió con %d ofertas", name, len(results))
                return results, name
            except Exception as exc:
                logger.warning("Proveedor '%s' falló (%s), probando siguiente...", name, exc)
                errors.append(f"{name}: {exc}")

        raise RuntimeError(
            f"Todos los proveedores fallaron para {origin}→{destination}. "
            + " | ".join(errors)
        )
