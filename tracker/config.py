"""Carga env vars y configuración del proyecto."""

import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()


class _Settings:
    """Contenedor de configuración cargada desde variables de entorno."""

    def __init__(self):
        self.SERPAPI_KEY: str = self._require("SERPAPI_KEY")

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

    def __repr__(self) -> str:
        return f"Settings(SUPABASE_URL={self.SUPABASE_URL!r})"


Settings = _Settings()
