"""PeakGuard Capacity Simulator - Web Dashboard Server (Flask).

Run with: python app.py
Serves custom HTML/CSS/JS frontend on http://127.0.0.1:5000
"""
import os
import threading
import webbrowser
from flask import Flask, jsonify, request, send_from_directory
import numpy as np
import pandas as pd

from simulator import CFG, SCENARIOS, run_scenario

app = Flask(__name__, static_folder=".")


def sanitize_val(val):
    """Convert numpy / pandas types into standard JSON serializable Python primitives."""
    if isinstance(val, (np.floating, float)):
        return float(val)
    elif isinstance(val, (np.integer, int)):
        return int(val)
    elif isinstance(val, np.ndarray):
        return val.tolist()
    elif isinstance(val, pd.DataFrame):
        return val.to_dict(orient="records")
    elif isinstance(val, dict):
        return {k: sanitize_val(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [sanitize_val(x) for x in val]
    return val


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)


@app.route("/api/scenarios", methods=["GET"])
def get_scenarios():
    return jsonify(sanitize_val(SCENARIOS))


@app.route("/api/simulate", methods=["POST"])
def simulate():
    data = request.get_json() or {}
    scen = data.get("scenario", "scheduled_sale")
    overrides = {}

    for k in ["start_workers", "max_workers", "worker_tps", "warmup_s"]:
        if k in data and data[k] is not None:
            overrides[k] = int(data[k])

    raw_out = run_scenario(scen, overrides)
    clean_out = sanitize_val(raw_out)
    return jsonify(clean_out)


@app.route("/api/sensitivity", methods=["GET"])
def get_sensitivity():
    rows = []

    def add(var, val, scen, out):
        for pol in ["Legacy", "PeakGuard"]:
            m = out[pol]["metrics"]
            meets = m["availability"] >= 99.9 and m["breach_minutes"] <= 1.0
            rows.append(dict(variable=var, value=val, scenario=scen, policy=pol,
                             availability=float(m["availability"]), p95_latency=float(m["p95_latency"]),
                             breach_minutes=float(m["breach_minutes"]), failed=int(m["failed"]),
                             worker_minutes=float(m["worker_minutes"]), meets_slo=bool(meets)))

    for wu in [30, 120, 300]:
        add("warmup_s", wu, "sudden_spike", run_scenario("sudden_spike", dict(warmup_s=wu)))
    for mw in [10, 20, 30]:
        add("max_workers", mw, "scheduled_sale", run_scenario("scheduled_sale", dict(max_workers=mw)))
    for wt in [20, 30, 40]:
        add("worker_tps", wt, "worker_loss", run_scenario("worker_loss", dict(worker_tps=wt)))

    return jsonify(rows)


def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000/")


if __name__ == "__main__":
    print("=" * 60)
    print("  PeakGuard Capacity Simulator — Web Dashboard")
    print("  URL: http://127.0.0.1:5000")
    print("=" * 60)
    threading.Timer(1.2, open_browser).start()
    app.run(host="127.0.0.1", port=5000, debug=False)
