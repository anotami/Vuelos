"""Entry point del GitHub Action. Orquesta búsqueda → análisis → persistencia."""

import os
import yaml
from datetime import date, timedelta
from tracker.search.serpapi_client import SerpApiClient
from tracker.search.multi_stop import find_arbitrage_combos
from tracker.analyzer.baseline import compute_baseline, should_alert
from tracker.storage.supabase_client import SupabaseClient


def run():
    cfg = yaml.safe_load(open("tracker/routes.yaml"))
    db = SupabaseClient()
    serpapi = SerpApiClient()

    single_route_id = os.getenv("ROUTE_ID", "").strip() or None

    all_routes = db.get_enabled_routes()
    routes = (
        [r for r in all_routes if r["id"] == single_route_id]
        if single_route_id
        else all_routes
    )

    errors = []

    for route in routes:
        for offset in cfg["defaults"]["search_window_days"]:
            for trip_len in cfg["defaults"]["trip_duration_days"]:
                dep = date.today() + timedelta(days=offset)
                ret = dep + timedelta(days=trip_len)

                try:
                    offers = serpapi.search(route["origin"], route["destination"], dep, ret)
                except Exception as exc:
                    errors.append(f"{route['origin']}→{route['destination']} {dep}: {exc}")
                    continue

                if not offers:
                    continue

                snapshot_ids = db.insert_snapshots(route["id"], offers, dep, ret)

                history = db.get_route_history(route["id"], travel_month=dep.month)
                baseline = compute_baseline(history, route["id"], dep.month, date.today())
                cheapest = min(offers, key=lambda o: o["price_usd"])
                alert, kind = should_alert(
                    cheapest["price_usd"], baseline, route.get("absolute_threshold")
                )
                if alert:
                    db.insert_alert(
                        route["id"], snapshot_ids[0], kind, cheapest["price_usd"], baseline
                    )

                if cfg["defaults"]["multi_stop_enabled"] and route.get("multi_stop_enabled", True):
                    try:
                        combos = find_arbitrage_combos(
                            route["origin"],
                            route["destination"],
                            dep.isoformat(),
                            offers,
                            serpapi.search,
                        )
                        db.insert_multi_stop_combos(route["id"], combos, dep)
                    except Exception as exc:
                        errors.append(f"multi_stop {route['origin']}→{route['destination']}: {exc}")

    if errors:
        import sys
        print(f"\n{len(errors)} errores durante la búsqueda:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    run()
