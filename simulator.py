"""PeakGuard: peak-demand capacity simulator (synthetic workload, no real payment data)."""
import numpy as np
import pandas as pd

LAT_SLO_MS = 300.0      # latency SLO: served transactions under this
AVAIL_SLO = 99.9        # availability SLO in percent
TIMEOUT_MS = 1000.0     # transaction times out beyond this wait
BASE_MS = 100.0         # base processing time per transaction
EVAL_EVERY = 30         # scaling policies evaluated every N seconds


def demand_series(duration_min, base_tps, events, seed=42):
    rng = np.random.default_rng(seed)
    out = np.zeros(duration_min * 60)
    for s in range(len(out)):
        m = s // 60
        mult = 1.0
        for ev in events:
            if ev["start_min"] <= m < ev["start_min"] + ev["duration_min"]:
                mult = max(mult, ev["multiplier"])
        out[s] = max(0, base_tps * mult * rng.normal(1, 0.04))
    return out


def legacy_policy(s, h, cfg):
    """Average-utilisation reactive autoscaling: 5-min avg util > 75% -> +1 worker,
    300s cooldown, warm-up delay applied by engine. Ignores events and queue depth."""
    if s < 300 or s < h["cooldown_until"]:
        return 0
    u = np.mean(h["util"][-300:])
    if u > 0.75:
        h["cooldown_until"] = s + 300
        return 1
    if u < 0.40 and h["active"] > cfg["start_workers"]:
        h["cooldown_until"] = s + 300
        return -1
    return 0


def peakguard_policy(s, h, cfg):
    """Scenario-aware scaling: pre-scales 5 min before known events, holds 30% headroom,
    batch-scales when queue backlog per worker exceeds 25."""
    m = s // 60
    forecast = np.mean(h["demand"][-60:]) if h["demand"] else cfg["base_tps"]
    for ev in cfg["events"]:
        if ev.get("known") and ev["start_min"] * 60 - 300 <= s < (ev["start_min"] + ev["duration_min"]) * 60:
            forecast = max(forecast, cfg["base_tps"] * ev["multiplier"])
    needed = int(np.ceil(forecast / (cfg["worker_tps"] * 0.70)))
    backlog = h["queue"] / max(h["active"], 1)
    target = max(needed, h["active"])
    if backlog > 25:
        target = max(target, h["active"] + 2)
    add = target - h["active"] - sum(c for _, c in h["pending"])
    if add > 0:
        return add
    if len(h["util"]) >= 300 and backlog < 5 and np.mean(h["util"][-300:]) < 0.45 and h["active"] > 2:
        return -1
    return 0


def run_sim(tps, policy_fn, cfg, seed=1):
    rng = np.random.default_rng(seed)
    queue, active, pending = 0.0, cfg["start_workers"], []
    h = {"util": [], "demand": [], "queue": 0.0, "active": active, "pending": pending, "cooldown_until": -1}
    arrived = served = failed = 0.0
    worker_s = breach = 0
    lats, rec = [], []
    down_until, dead = None, 0
    for s, dem in enumerate(tps):
        m = s // 60
        f = cfg.get("failure")
        if f and down_until is None and m == f["minute"]:
            dead = min(active, int(np.ceil(active * f["fraction"])))
            active -= dead
            down_until = (f["minute"] + f["duration_min"]) * 60
        if down_until is not None and s >= down_until:
            active += dead
            dead, down_until = 0, None
        active += sum(c for rs, c in pending if rs <= s)
        pending[:] = [(rs, c) for rs, c in pending if rs > s]
        active = min(active, cfg["max_workers"])
        cap = max(active * cfg["worker_tps"], 1)
        carry = queue                                   # backlog waiting from previous seconds
        arr = max(0, rng.normal(dem, dem * 0.03))
        queue += arr
        arrived += arr
        proc = min(queue, cap)                          # server processes first
        queue -= proc
        served += proc
        overflow = max(0.0, queue - cap * (TIMEOUT_MS - BASE_MS) / 1000)  # would exceed timeout
        failed += overflow
        queue -= overflow
        lat = BASE_MS + (carry / cap) * 1000 + rng.normal(0, 8)
        if proc > 0:
            lats.append(lat)
            if lat > LAT_SLO_MS:
                breach += 1
        worker_s += active
        h["util"].append(proc / cap)
        h["demand"].append(arr)
        h["queue"], h["active"] = queue, active
        if s % EVAL_EVERY == 0:
            d = policy_fn(s, h, cfg)
            if d > 0:
                pending.append((s + cfg["warmup_s"], d))
            elif d < 0 and active > 2:
                active -= 1
        if s % 60 == 0:
            rec.append(dict(minute=m, tps=round(arr, 1), queue=round(queue, 1), workers=active,
                            pending=sum(c for _, c in pending), lat_ms=round(max(lat, 1), 1)))
    metrics = dict(availability=round(100 * served / max(arrived, 1), 2),
                   p95_latency=round(float(np.percentile(lats, 95)), 1),
                   max_queue=int(max(r["queue"] for r in rec)),
                   breach_minutes=round(breach / 60, 1),
                   worker_minutes=round(worker_s / 60, 1),
                   failed=int(failed), arrived=int(arrived))
    return metrics, pd.DataFrame(rec)


CFG = dict(start_workers=4, max_workers=20, worker_tps=30, warmup_s=120)

SCENARIOS = {
    "normal_day": dict(duration=60, base_tps=90, events=[], failure=None),
    "scheduled_sale": dict(duration=60, base_tps=90,
                           events=[dict(start_min=15, duration_min=10, multiplier=5.0, known=True)],
                           failure=None),
    "sudden_spike": dict(duration=60, base_tps=90,
                         events=[dict(start_min=20, duration_min=5, multiplier=6.0, known=False)],
                         failure=None),
    "worker_loss": dict(duration=60, base_tps=90,
                        events=[dict(start_min=15, duration_min=10, multiplier=3.0, known=True)],
                        failure=dict(minute=20, fraction=0.30, duration_min=10)),
}

POLICIES = {"Legacy": legacy_policy, "PeakGuard": peakguard_policy}


def run_scenario(name, overrides=None, seed=1):
    sc = SCENARIOS[name]
    cfg = dict(CFG)
    cfg.update(sc)
    cfg.update(overrides or {})
    tps = demand_series(cfg["duration"], cfg["base_tps"], cfg["events"])
    out = {"cfg": cfg, "sla": dict(latency_ms=LAT_SLO_MS, availability_pct=AVAIL_SLO)}
    for label, fn in POLICIES.items():
        met, df = run_sim(tps, fn, cfg, seed=seed)
        out[label] = dict(metrics=met, trace=df)
    return out


if __name__ == "__main__":
    rows = []
    for name in SCENARIOS:
        res = run_scenario(name)
        for label in POLICIES:
            rows.append(dict(scenario=name, policy=label, **res[label]["metrics"]))
    print(pd.DataFrame(rows).to_string(index=False))
