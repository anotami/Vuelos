"""Tests unitarios para tracker/analyzer/baseline.py."""

import pytest
import numpy as np
import pandas as pd
from datetime import date, timedelta

from tracker.analyzer.baseline import compute_baseline, should_alert


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ROUTE_ID = "route-abc-123"
TRAVEL_MONTH = 7  # July


def _make_df(prices: list[float], route_id: str = ROUTE_ID, month: int = TRAVEL_MONTH) -> pd.DataFrame:
    """Build a synthetic DataFrame in the same schema as get_route_history returns.

    All search_date values are within the last 90 days so they always fall
    inside the baseline window.
    """
    today = date.today()
    n = len(prices)
    rows = []
    for i, price in enumerate(prices):
        search_d = today - timedelta(days=n - i)
        dep_dt = pd.Timestamp(year=today.year, month=month, day=15) + timedelta(days=i % 10)
        rows.append(
            {
                "route_id": route_id,
                "search_date": search_d,
                "departure_date": dep_dt,
                "price_usd": float(price),
            }
        )
    df = pd.DataFrame(rows)
    df["search_date"] = pd.to_datetime(df["search_date"]).dt.date
    df["departure_date"] = pd.to_datetime(df["departure_date"])
    df["price_usd"] = df["price_usd"].astype(float)
    return df


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestComputeBaseline:
    """Unit tests for compute_baseline()."""

    def test_cold_start_when_n_lt_30(self):
        """With fewer than 30 observations cold_start must be True."""
        df = _make_df([500.0] * 29)
        result = compute_baseline(df, ROUTE_ID, TRAVEL_MONTH, date.today())
        assert result["cold_start"] is True
        assert result["n"] == 29
        assert result["baseline"] is None

    def test_warm_start_when_n_gte_30(self):
        """With 30+ observations cold_start must be False and baseline present."""
        df = _make_df([400.0] * 35)
        result = compute_baseline(df, ROUTE_ID, TRAVEL_MONTH, date.today())
        assert result["cold_start"] is False
        assert result["n"] == 35
        assert result["baseline"] is not None
        assert "ema" in result

    def test_compute_baseline_correct_p25(self):
        """Verify that the returned baseline equals numpy's 25th-percentile."""
        prices = [300.0, 350.0, 400.0, 420.0, 450.0, 500.0, 520.0, 550.0,
                  600.0, 650.0, 700.0, 720.0, 750.0, 800.0, 850.0, 900.0,
                  300.0, 310.0, 320.0, 330.0, 340.0, 360.0, 370.0, 380.0,
                  390.0, 410.0, 430.0, 440.0, 460.0, 470.0]
        assert len(prices) == 30
        df = _make_df(prices)
        result = compute_baseline(df, ROUTE_ID, TRAVEL_MONTH, date.today())
        expected_p25 = float(np.percentile(prices, 25))
        assert result["baseline"] == pytest.approx(expected_p25, rel=1e-6)

    def test_filters_by_route_id(self):
        """Observations belonging to a different route must be ignored."""
        df_other = _make_df([200.0] * 30, route_id="other-route")
        df_target = _make_df([600.0] * 5, route_id=ROUTE_ID)
        df = pd.concat([df_other, df_target], ignore_index=True)
        result = compute_baseline(df, ROUTE_ID, TRAVEL_MONTH, date.today())
        assert result["cold_start"] is True
        assert result["n"] == 5

    def test_filters_by_travel_month(self):
        """Observations for a different departure month must be excluded."""
        other_month = 12 if TRAVEL_MONTH != 12 else 1
        df_wrong = _make_df([200.0] * 30, month=other_month)
        df_right = _make_df([600.0] * 10, month=TRAVEL_MONTH)
        df = pd.concat([df_wrong, df_right], ignore_index=True)
        result = compute_baseline(df, ROUTE_ID, TRAVEL_MONTH, date.today())
        # 10 observations for the correct month → cold start
        assert result["cold_start"] is True
        assert result["n"] == 10

    def test_respects_90_day_window(self):
        """Observations older than 90 days must not contribute to the baseline."""
        today = date.today()
        old_prices = [200.0] * 20
        new_prices = [600.0] * 15

        old_rows = []
        for i, p in enumerate(old_prices):
            old_rows.append(
                {
                    "route_id": ROUTE_ID,
                    "search_date": today - timedelta(days=100 + i),
                    "departure_date": pd.Timestamp(year=today.year, month=TRAVEL_MONTH, day=15),
                    "price_usd": float(p),
                }
            )
        new_rows = []
        for i, p in enumerate(new_prices):
            new_rows.append(
                {
                    "route_id": ROUTE_ID,
                    "search_date": today - timedelta(days=i + 1),
                    "departure_date": pd.Timestamp(year=today.year, month=TRAVEL_MONTH, day=15),
                    "price_usd": float(p),
                }
            )
        df = pd.DataFrame(old_rows + new_rows)
        df["search_date"] = pd.to_datetime(df["search_date"]).dt.date
        df["departure_date"] = pd.to_datetime(df["departure_date"])
        df["price_usd"] = df["price_usd"].astype(float)

        result = compute_baseline(df, ROUTE_ID, TRAVEL_MONTH, today)
        # Only the 15 new rows are inside the window → cold start
        assert result["cold_start"] is True
        assert result["n"] == 15


class TestShouldAlert:
    """Unit tests for should_alert()."""

    # --- cold-start branch ---

    def test_cold_start_with_absolute(self):
        """n<30 + price <= absolute_threshold → alert of type 'absolute'."""
        baseline = {"cold_start": True, "n": 10, "baseline": None}
        alert, kind = should_alert(current=299.0, baseline=baseline, absolute_threshold=300.0)
        assert alert is True
        assert kind == "absolute"

    def test_cold_start_price_equals_absolute(self):
        """Price exactly equal to absolute_threshold still triggers the alert."""
        baseline = {"cold_start": True, "n": 5, "baseline": None}
        alert, kind = should_alert(current=300.0, baseline=baseline, absolute_threshold=300.0)
        assert alert is True
        assert kind == "absolute"

    def test_cold_start_without_absolute(self):
        """n<30 and no absolute_threshold → no alert."""
        baseline = {"cold_start": True, "n": 10, "baseline": None}
        alert, kind = should_alert(current=200.0, baseline=baseline, absolute_threshold=None)
        assert alert is False
        assert kind == "cold_start"

    def test_cold_start_above_absolute_threshold(self):
        """n<30 but price > absolute_threshold → no alert."""
        baseline = {"cold_start": True, "n": 15, "baseline": None}
        alert, kind = should_alert(current=400.0, baseline=baseline, absolute_threshold=300.0)
        assert alert is False
        assert kind == "cold_start"

    # --- baseline branch ---

    def test_baseline_alert_triggers(self):
        """Price < 70% of P25 AND < EMA → alert of type 'baseline'."""
        p25 = 600.0
        baseline = {
            "cold_start": False,
            "n": 50,
            "baseline": p25,
            "ema": 620.0,
        }
        # 0.70 * 600 = 420 → use 400 to be comfortably below both thresholds
        alert, kind = should_alert(current=400.0, baseline=baseline, absolute_threshold=None)
        assert alert is True
        assert kind == "baseline"

    def test_baseline_no_alert_above_threshold(self):
        """Price above 70% of P25 → no alert even if below EMA."""
        p25 = 600.0
        baseline = {
            "cold_start": False,
            "n": 50,
            "baseline": p25,
            "ema": 620.0,
        }
        # 0.70 * 600 = 420 → use 450 (above threshold)
        alert, kind = should_alert(current=450.0, baseline=baseline, absolute_threshold=None)
        assert alert is False
        assert kind == "no_alert"

    def test_baseline_no_alert_below_p25_but_above_ema(self):
        """Price < 70% of P25 but price >= EMA → no alert (both conditions required)."""
        p25 = 600.0
        ema = 350.0  # EMA is very low
        baseline = {
            "cold_start": False,
            "n": 50,
            "baseline": p25,
            "ema": ema,
        }
        # 0.70 * 600 = 420 → use 400, but 400 >= 350 → condition fails
        alert, kind = should_alert(current=400.0, baseline=baseline, absolute_threshold=None)
        assert alert is False
        assert kind == "no_alert"

    def test_baseline_alert_ignores_absolute_threshold(self):
        """When not cold-start, absolute_threshold is irrelevant; baseline logic governs."""
        p25 = 600.0
        baseline = {
            "cold_start": False,
            "n": 50,
            "baseline": p25,
            "ema": 620.0,
        }
        # Absolute threshold very high; should still trigger via baseline
        alert, kind = should_alert(current=400.0, baseline=baseline, absolute_threshold=1000.0)
        assert alert is True
        assert kind == "baseline"
