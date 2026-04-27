"""Tests unitarios para tracker/search/multi_stop.py."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from tracker.search.multi_stop import find_arbitrage_combos, HUBS_CONFIG


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

DEP_DATE = "2026-07-15"
ORIGIN = "LIM"
DESTINATION = "MAD"


def _make_offer(
    price: float,
    departure_iso: str,
    arrival_iso: str,
    airline: str = "XX",
    stops: int = 0,
) -> dict:
    """Return a minimal normalized flight offer dict."""
    return {
        "price_usd": price,
        "airline": airline,
        "stops": stops,
        "duration_minutes": 120,
        "departure_date": departure_iso[:10],
        "return_date": None,
        "booking_link": None,
        "raw_data": {},
        "source": "test",
        "arrival_iso": arrival_iso,
        "departure_iso": departure_iso,
    }


def _direct_offer(price: float = 900.0) -> list[dict]:
    return [
        _make_offer(
            price=price,
            departure_iso=f"{DEP_DATE}T07:00:00",
            arrival_iso=f"{DEP_DATE}T22:00:00",
            airline="LA",
        )
    ]


# ---------------------------------------------------------------------------
# Test 1 — cheaper combo surfaces in results
# ---------------------------------------------------------------------------


def test_finds_cheaper_combo():
    """A combo whose total < direct_min must appear in the returned results."""
    direct_price = 900.0
    direct_offers = _direct_offer(direct_price)

    # Leg1: LIM → PTY arriving 10:00
    leg1 = _make_offer(
        price=200.0,
        departure_iso=f"{DEP_DATE}T07:00:00",
        arrival_iso=f"{DEP_DATE}T10:00:00",
        airline="CM",
    )
    # Leg2: PTY → MAD departing 14:30 (4.5 h buffer — exceeds 4 h minimum for PTY)
    leg2 = _make_offer(
        price=600.0,
        departure_iso=f"{DEP_DATE}T14:30:00",
        arrival_iso=f"{DEP_DATE}T23:00:00",
        airline="IB",
    )

    def mock_search(orig, dest, dep, departure_after=None, max_results=5):
        if orig == ORIGIN and dest == "PTY":
            return [leg1]
        if orig == "PTY" and dest == DESTINATION:
            return [leg2]
        return []

    combos = find_arbitrage_combos(
        ORIGIN,
        DESTINATION,
        DEP_DATE,
        direct_offers,
        mock_search,
        min_savings_pct=5.0,
        user_has_us_visa=True,
    )

    assert len(combos) >= 1
    total_prices = [c["total_price"] for c in combos]
    assert any(t < direct_price for t in total_prices)


# ---------------------------------------------------------------------------
# Test 2 — expensive combo does NOT surface
# ---------------------------------------------------------------------------


def test_excludes_expensive_combos():
    """A combo whose total >= direct_min must be excluded."""
    direct_price = 800.0
    direct_offers = _direct_offer(direct_price)

    # Legs sum to 850 > 800
    leg1 = _make_offer(
        price=400.0,
        departure_iso=f"{DEP_DATE}T07:00:00",
        arrival_iso=f"{DEP_DATE}T10:00:00",
    )
    leg2 = _make_offer(
        price=450.0,
        departure_iso=f"{DEP_DATE}T14:30:00",
        arrival_iso=f"{DEP_DATE}T22:00:00",
    )

    def mock_search(orig, dest, dep, departure_after=None, max_results=5):
        if orig == ORIGIN:
            return [leg1]
        return [leg2]

    combos = find_arbitrage_combos(
        ORIGIN,
        DESTINATION,
        DEP_DATE,
        direct_offers,
        mock_search,
        min_savings_pct=0.0,
        user_has_us_visa=True,
    )

    assert all(c["total_price"] < direct_price for c in combos)


# ---------------------------------------------------------------------------
# Test 3 — visa filter: MIA excluded when user has no US visa
# ---------------------------------------------------------------------------


def test_visa_filter():
    """MIA hub must be excluded when user_has_us_visa=False."""
    direct_offers = _direct_offer(900.0)

    leg1_mia = _make_offer(
        price=100.0,
        departure_iso=f"{DEP_DATE}T07:00:00",
        arrival_iso=f"{DEP_DATE}T10:00:00",
        airline="AA",
    )
    leg2_mia = _make_offer(
        price=200.0,
        departure_iso=f"{DEP_DATE}T15:00:00",
        arrival_iso=f"{DEP_DATE}T23:00:00",
        airline="IB",
    )

    calls = []

    def mock_search(orig, dest, dep, departure_after=None, max_results=5):
        calls.append((orig, dest))
        if orig == ORIGIN and dest == "MIA":
            return [leg1_mia]
        if orig == "MIA" and dest == DESTINATION:
            return [leg2_mia]
        return []

    combos = find_arbitrage_combos(
        ORIGIN,
        DESTINATION,
        DEP_DATE,
        direct_offers,
        mock_search,
        min_savings_pct=0.0,
        user_has_us_visa=False,
    )

    # No combo should involve MIA
    for combo in combos:
        assert combo["hub"] != "MIA"

    # MIA should never have been queried
    queried_dests = [dest for _, dest in calls]
    assert "MIA" not in queried_dests


# ---------------------------------------------------------------------------
# Test 4 — buffer time enforced: leg2 departing too soon is excluded
# ---------------------------------------------------------------------------


def test_buffer_time_enforced():
    """Leg2 departing before arrival + min_buffer_h must be excluded."""
    direct_offers = _direct_offer(900.0)

    hub = "BOG"  # min_buffer_h = 4
    leg1 = _make_offer(
        price=150.0,
        departure_iso=f"{DEP_DATE}T07:00:00",
        arrival_iso=f"{DEP_DATE}T09:00:00",  # arrives 09:00
        airline="AV",
    )
    # Leg2 departs at 12:00 — only 3h after arrival; less than 4h minimum
    leg2_too_soon = _make_offer(
        price=300.0,
        departure_iso=f"{DEP_DATE}T12:00:00",  # only 3h after arrival
        arrival_iso=f"{DEP_DATE}T22:00:00",
        airline="IB",
    )
    # Leg2 departs at 14:00 — 5h after arrival; satisfies 4h buffer
    leg2_valid = _make_offer(
        price=300.0,
        departure_iso=f"{DEP_DATE}T14:00:00",  # 5h after arrival — valid
        arrival_iso=f"{DEP_DATE}T22:00:00",
        airline="IB",
    )

    def mock_search(orig, dest, dep, departure_after=None, max_results=5):
        if orig == ORIGIN and dest == hub:
            return [leg1]
        if orig == hub and dest == DESTINATION:
            if departure_after is not None:
                # Simulate what the real search_fn would do:
                # filter out departures before the required window
                results = []
                for leg in [leg2_too_soon, leg2_valid]:
                    dep_dt = datetime.fromisoformat(leg["departure_iso"])
                    if dep_dt >= departure_after:
                        results.append(leg)
                return results[:max_results]
            return [leg2_too_soon, leg2_valid]
        return []

    combos = find_arbitrage_combos(
        ORIGIN,
        DESTINATION,
        DEP_DATE,
        direct_offers,
        mock_search,
        min_savings_pct=0.0,
        user_has_us_visa=True,
    )

    bog_combos = [c for c in combos if c["hub"] == hub]
    # All valid combos must have a layover >= min_buffer_h
    min_buffer = HUBS_CONFIG[hub]["min_buffer_h"]
    for combo in bog_combos:
        assert combo["layover_hours"] >= min_buffer, (
            f"Expected layover >= {min_buffer}h, got {combo['layover_hours']:.2f}h"
        )


# ---------------------------------------------------------------------------
# Test 5 — savings_pct calculation
# ---------------------------------------------------------------------------


def test_savings_pct_calculation():
    """Verify the savings percentage formula: (direct - total) / direct * 100."""
    direct_price = 1000.0
    leg1_price = 200.0
    leg2_price = 600.0
    expected_total = leg1_price + leg2_price  # 800
    expected_savings_pct = (direct_price - expected_total) / direct_price * 100  # 20.0

    direct_offers = _direct_offer(direct_price)

    leg1 = _make_offer(
        price=leg1_price,
        departure_iso=f"{DEP_DATE}T07:00:00",
        arrival_iso=f"{DEP_DATE}T10:00:00",
        airline="LA",
    )
    leg2 = _make_offer(
        price=leg2_price,
        departure_iso=f"{DEP_DATE}T14:30:00",
        arrival_iso=f"{DEP_DATE}T23:00:00",
        airline="IB",
    )

    def mock_search(orig, dest, dep, departure_after=None, max_results=5):
        if orig == ORIGIN and dest == "PTY":
            return [leg1]
        if orig == "PTY" and dest == DESTINATION:
            return [leg2]
        return []

    combos = find_arbitrage_combos(
        ORIGIN,
        DESTINATION,
        DEP_DATE,
        direct_offers,
        mock_search,
        min_savings_pct=0.0,
        user_has_us_visa=True,
    )

    pty_combos = [c for c in combos if c["hub"] == "PTY"]
    assert len(pty_combos) >= 1
    combo = pty_combos[0]
    assert combo["total_price"] == pytest.approx(expected_total)
    assert combo["savings_pct"] == pytest.approx(expected_savings_pct, rel=1e-6)


# ---------------------------------------------------------------------------
# Test 6 — min_savings_pct filter
# ---------------------------------------------------------------------------


def test_min_savings_pct_filter():
    """Combos below min_savings_pct threshold must be excluded."""
    direct_price = 1000.0
    direct_offers = _direct_offer(direct_price)

    # Combo saves only 5%, threshold is 15% → should be excluded
    leg1 = _make_offer(
        price=480.0,
        departure_iso=f"{DEP_DATE}T07:00:00",
        arrival_iso=f"{DEP_DATE}T10:00:00",
    )
    leg2 = _make_offer(
        price=470.0,
        departure_iso=f"{DEP_DATE}T14:30:00",
        arrival_iso=f"{DEP_DATE}T23:00:00",
    )
    # total = 950, savings = 5%

    def mock_search(orig, dest, dep, departure_after=None, max_results=5):
        if orig == ORIGIN and dest == "PTY":
            return [leg1]
        if orig == "PTY" and dest == DESTINATION:
            return [leg2]
        return []

    combos = find_arbitrage_combos(
        ORIGIN,
        DESTINATION,
        DEP_DATE,
        direct_offers,
        mock_search,
        min_savings_pct=15.0,
        user_has_us_visa=True,
    )

    pty_combos = [c for c in combos if c["hub"] == "PTY"]
    assert len(pty_combos) == 0


# ---------------------------------------------------------------------------
# Test 7 — results sorted by descending savings_pct
# ---------------------------------------------------------------------------


def test_results_sorted_by_savings_desc():
    """Results must be sorted by savings_pct in descending order."""
    direct_price = 1000.0
    direct_offers = _direct_offer(direct_price)

    # PTY combo: saves 30% (total 700)
    leg1_pty = _make_offer(300.0, f"{DEP_DATE}T07:00:00", f"{DEP_DATE}T09:30:00", "CM")
    leg2_pty = _make_offer(400.0, f"{DEP_DATE}T14:00:00", f"{DEP_DATE}T23:00:00", "IB")

    # BOG combo: saves 20% (total 800)
    leg1_bog = _make_offer(350.0, f"{DEP_DATE}T07:00:00", f"{DEP_DATE}T09:00:00", "AV")
    leg2_bog = _make_offer(450.0, f"{DEP_DATE}T13:30:00", f"{DEP_DATE}T23:00:00", "IB")

    def mock_search(orig, dest, dep, departure_after=None, max_results=5):
        if orig == ORIGIN and dest == "PTY":
            return [leg1_pty]
        if orig == "PTY" and dest == DESTINATION:
            return [leg2_pty]
        if orig == ORIGIN and dest == "BOG":
            return [leg1_bog]
        if orig == "BOG" and dest == DESTINATION:
            return [leg2_bog]
        return []

    combos = find_arbitrage_combos(
        ORIGIN,
        DESTINATION,
        DEP_DATE,
        direct_offers,
        mock_search,
        min_savings_pct=0.0,
        user_has_us_visa=True,
    )

    savings = [c["savings_pct"] for c in combos]
    assert savings == sorted(savings, reverse=True)
