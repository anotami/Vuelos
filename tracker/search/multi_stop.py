"""Búsqueda de combinaciones LIM→Hub→Destino con tickets separados.

Validaciones:
- Buffer mínimo 4h carry-on / 6h con maleta facturada
- Hubs USA requieren visa de tránsito (validar flag de usuario)
- Mismo aeropuerto en hub (excluye combos JFK→LGA, LHR→LGW)
"""

from datetime import datetime, timedelta

HUBS_CONFIG = {
    "PTY": {"requires_us_visa": False, "min_buffer_h": 4, "stopover_program": True},
    "BOG": {"requires_us_visa": False, "min_buffer_h": 4, "stopover_program": True},
    "MIA": {"requires_us_visa": True,  "min_buffer_h": 5},
    "GRU": {"requires_us_visa": False, "min_buffer_h": 5},
    "MEX": {"requires_us_visa": False, "min_buffer_h": 4},
    "SCL": {"requires_us_visa": False, "min_buffer_h": 4},
}


def find_arbitrage_combos(
    origin: str,
    destination: str,
    dep_date: str,
    direct_offers: list,
    search_fn,
    min_savings_pct: float = 15.0,
    user_has_us_visa: bool = True,
    with_checked_bag: bool = False,
):
    direct_min = min(o["price_usd"] for o in direct_offers) if direct_offers else float("inf")
    candidates = []

    for hub, cfg in HUBS_CONFIG.items():
        if hub in (origin, destination):
            continue
        if cfg["requires_us_visa"] and not user_has_us_visa:
            continue

        min_buffer = cfg["min_buffer_h"] + (2 if with_checked_bag else 0)

        leg1_offers = search_fn(origin, hub, dep_date, max_results=5)
        for leg1 in leg1_offers:
            arrival = datetime.fromisoformat(leg1["arrival_iso"])
            min_dep_leg2 = arrival + timedelta(hours=min_buffer)

            leg2_offers = search_fn(
                hub, destination, dep_date, departure_after=min_dep_leg2, max_results=3
            )
            for leg2 in leg2_offers:
                total = leg1["price_usd"] + leg2["price_usd"]
                if total >= direct_min:
                    continue
                savings_pct = (direct_min - total) / direct_min * 100
                if savings_pct < min_savings_pct:
                    continue

                candidates.append({
                    "hub": hub,
                    "leg1": leg1,
                    "leg2": leg2,
                    "total_price": total,
                    "direct_price": direct_min,
                    "savings_pct": savings_pct,
                    "layover_hours": (
                        datetime.fromisoformat(leg2["departure_iso"]) - arrival
                    ).total_seconds() / 3600,
                    "warnings": (
                        ["separate_tickets"]
                        + (["visa_required"] if cfg["requires_us_visa"] else [])
                        + (["stopover_available"] if cfg.get("stopover_program") else [])
                    ),
                })

    return sorted(candidates, key=lambda x: -x["savings_pct"])
