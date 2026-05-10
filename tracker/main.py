"""Entry point del GitHub Action. Orquesta búsqueda → análisis → persistencia."""

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

    for route in db.get_enabled_routes():
        for offset in cfg["defaults"]["search_window_days"]:
            for trip_len in cfg["defaults"]["trip_duration_days"]:
                dep = date.today() + timedelta(days=offset)
                ret = dep + timedelta(days=trip_len)

                offers = serpapi.search(route["origin"], route["destination"], dep, ret)
                db.log_serpapi_call(route["origin"], route["destination"])

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
                    combos = find_arbitrage_combos(
                        route["origin"],
                        route["destination"],
                        dep.isoformat(),
                        offers,
                        serpapi.search,
                    )
                    db.insert_multi_stop_combos(route["id"], combos, dep)


if __name__ == "__main__":
    run()
