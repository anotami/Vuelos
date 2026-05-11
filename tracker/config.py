"""Carga env vars y configuración del proyecto."""

import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()


class _Settings:
    """Contenedor de configuración cargada desde variables de entorno."""

    def __init__(self):
        self.SERPAPI_KEY: str | None = self._optional("SERPAPI_KEY")

        self.AMADEUS_CLIENT_ID: str | None = self._optional("AMADEUS_CLIENT_ID")
        self.AMADEUS_CLIENT_SECRET: str | None = self._optional("AMADEUS_CLIENT_SECRET")
        self.AMADEUS_HOSTNAME: str = os.getenv("AMADEUS_HOSTNAME", "production")

        self.KIWI_API_KEY: str | None = self._optional("KIWI_API_KEY")

        self.SUPABASE_URL: str = self._require("SUPABASE_URL")
        self.SUPABASE_SERVICE_KEY: str = self._require("SUPABASE_SERVICE_KEY")

    @staticmethod
    def _require(name: str) -> str:
        value = os.getenv(name)
        if not value:
            raise ValueError(
                f"Variable de entorno requerida no encontrada: '{name}'. "
                "Asegúrate de que exista un archivo .env o que la variable esté definida."
            )
        return value

    @staticmethod
    def _optional(name: str) -> str | None:
        return os.getenv(name) or None

    def __repr__(self) -> str:
        return f"Settings(SUPABASE_URL={self.SUPABASE_URL!r})"


Settings = _Settings()
