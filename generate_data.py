"""Generates data/historical_load.csv: 30 days of synthetic per-minute gateway load.

Synthetic by construction. Legacy capacity (5 workers x 30 TPS) is sized for average
demand, so seasonal events show real stress: latency spikes, queue growth, failures.
Deterministic (seed=7) so the dataset is reproducible.
"""
import os

import numpy as np
import pandas as pd


def generate_historical_load(days=30, seed=7):
    rng = np.random.default_rng(seed)
    rows = []
    workers, tps_cap = 5, 30                      # legacy fleet sized for ~average demand
    start = pd.Timestamp("2026-08-01")
    queue = 0.0
    for day in range(days):
        d0 = start + pd.Timedelta(days=day)
        dow = d0.dayofweek
        for minute in range(1440):
            ts = d0 + pd.Timedelta(minutes=minute)
            hour = minute / 60
            diurnal = 0.35 + 0.65 * np.exp(-((hour - 13.5) ** 2) / 18)
            weekly = 0.8 if dow >= 5 else 1.0
            event, mult, incident = "normal", 1.0, 0
            if day == 0 and 540 <= minute < 600:
                event, mult = "salary_day", 2.2
            if day == 14 and 1140 <= minute < 1200:
                event, mult = "festival_sale", 5.0
            if day == 21 and 720 <= minute < 750:
                event, mult = "flash_sale", 3.5
            if day == 14 and 1150 <= minute < 1165:   # capacity loss during festival peak
                incident = 1
            tps = max(1, 90 * diurnal * weekly * mult * rng.normal(1, 0.06))
            cap = workers * tps_cap * (0.7 if incident else 1.0)
            arr = tps * 60
            proc = min(queue + arr, cap * 60)
            queue = queue + arr - proc
            wait = (queue / cap) * 1000
            p95 = 100 + min(wait, 2000) + abs(rng.normal(0, 10))
            fail_rate = min(0.6, max(0.0, (100 + wait - 900) / 900))
            failed = arr * fail_rate
            rows.append((ts, round(tps, 1), int(arr - failed), int(failed),
                         round(p95 / 1.4, 1), round(p95, 1), int(queue),
                         workers, event, incident))
    cols = ["timestamp", "requests_per_second", "successful_requests", "failed_requests",
            "avg_latency_ms", "p95_latency_ms", "queue_depth", "active_workers",
            "seasonal_event", "incident_flag"]
    return pd.DataFrame(rows, columns=cols)


if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    df = generate_historical_load()
    df.to_csv("data/historical_load.csv", index=False)
    ok, fail = df.successful_requests.sum(), df.failed_requests.sum()
    print(f"wrote data/historical_load.csv ({len(df)} rows)")
    print(f"overall availability: {100 * ok / (ok + fail):.2f}%")
    print(df[df.seasonal_event != "normal"].groupby("seasonal_event").agg(
        minutes=("timestamp", "count"), peak_tps=("requests_per_second", "max"),
        peak_p95_ms=("p95_latency_ms", "max"), failed_txns=("failed_requests", "sum")))
