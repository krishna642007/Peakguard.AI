"""Pytest suite for PeakGuard simulator. Run: pytest -q"""
from simulator import CFG, POLICIES, SCENARIOS, run_scenario


def test_peakguard_prescales_scheduled_sale():
    out = run_scenario("scheduled_sale")
    assert out["PeakGuard"]["metrics"]["availability"] >= 99.9
    assert out["PeakGuard"]["metrics"]["breach_minutes"] == 0.0


def test_legacy_fails_scheduled_sale():
    out = run_scenario("scheduled_sale")
    assert out["Legacy"]["metrics"]["availability"] < 75.0
    assert out["Legacy"]["metrics"]["breach_minutes"] >= 5.0


def test_peakguard_beats_legacy_in_every_peak():
    for name in ["scheduled_sale", "sudden_spike", "worker_loss"]:
        out = run_scenario(name)
        assert out["PeakGuard"]["metrics"]["availability"] > out["Legacy"]["metrics"]["availability"]
        assert out["PeakGuard"]["metrics"]["failed"] < out["Legacy"]["metrics"]["failed"]


def test_fleet_cap_never_exceeded():
    for name in SCENARIOS:
        out = run_scenario(name)
        for label in POLICIES:
            assert out[label]["trace"]["workers"].max() <= CFG["max_workers"]


def test_reproducible_with_fixed_seed():
    a = run_scenario("worker_loss", seed=3)["PeakGuard"]["metrics"]
    b = run_scenario("worker_loss", seed=3)["PeakGuard"]["metrics"]
    assert a == b


def test_metrics_and_queue_bounds():
    out = run_scenario("normal_day")
    for label in POLICIES:
        tr = out[label]["trace"]
        m = out[label]["metrics"]
        assert (tr["queue"] >= 0).all()
        assert (tr["workers"] > 0).all()
        assert 0.0 <= m["availability"] <= 100.0
        assert m["failed"] >= 0 and m["arrived"] > 0
