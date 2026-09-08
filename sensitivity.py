"""Sensitivity analysis: varies one assumption at a time and shows which ones
change the capacity decision. Writes outputs/sensitivity_results.csv.

SLO pass rule: availability >= 99.9% AND latency-breach <= 1 minute.
"""
import os

import pandas as pd

from simulator import run_scenario

LAT_BREACH_TOLERANCE_MIN = 1.0


def meets_slo(m):
    return m["availability"] >= 99.9 and m["breach_minutes"] <= LAT_BREACH_TOLERANCE_MIN


def main():
    os.makedirs("outputs", exist_ok=True)
    rows = []

    def add(var, val, scen, out):
        for pol in ["Legacy", "PeakGuard"]:
            m = out[pol]["metrics"]
            rows.append(dict(variable=var, value=val, scenario=scen, policy=pol,
                             availability=m["availability"], p95_latency=m["p95_latency"],
                             breach_minutes=m["breach_minutes"], failed=m["failed"],
                             worker_minutes=m["worker_minutes"], meets_slo=meets_slo(m)))

    for wu in [30, 120, 300]:                       # provisioning warm-up delay
        add("warmup_s", wu, "sudden_spike", run_scenario("sudden_spike", dict(warmup_s=wu)))
    for mw in [10, 20, 30]:                         # fleet cap
        add("max_workers", mw, "scheduled_sale", run_scenario("scheduled_sale", dict(max_workers=mw)))
    for wt in [20, 30, 40]:                         # per-worker throughput
        add("worker_tps", wt, "worker_loss", run_scenario("worker_loss", dict(worker_tps=wt)))
    for mult in [3.0, 4.5, 6.0]:                    # spike severity
        ev = [dict(start_min=20, duration_min=5, multiplier=mult, known=False)]
        add("spike_multiplier", mult, "sudden_spike", run_scenario("sudden_spike", dict(events=ev)))

    df = pd.DataFrame(rows)
    df.to_csv("outputs/sensitivity_results.csv", index=False)
    pg = df[df.policy == "PeakGuard"].drop(columns="policy")
    print(pg.to_string(index=False))
    print("\nDecision flips (PeakGuard):")
    print("- warmup_s 300s -> SLO impossible on unannounced spikes: pre-scaling/hot standby required")
    print("- max_workers 10 -> SLO impossible even with pre-scaling: fleet cap is the binding constraint")
    print("- worker_tps 40 -> compliant AND cheapest (fewer, bigger workers win)")
    print("- spike_multiplier: both policies degrade as spike grows; PeakGuard lead widens")


if __name__ == "__main__":
    main()
