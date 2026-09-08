# User Guide

## 1. Install

```bash
git clone <your-repo-url>
cd peakguard-capacity-simulator
pip install -r requirements.txt
```

Python 3.10+. No GPU, database, API keys, or internet access needed at runtime.

## 2. Run the dashboard (main demo)

```bash
python app.py
```
Opens the modern web dashboard automatically at `http://127.0.0.1:5000`.


- Sidebar: pick a workload scenario (normal day, scheduled sale, sudden spike, worker loss).
- Sidebar sliders = sensitivity analysis: starting workers, fleet cap, TPS per worker,
  scale-out warm-up. Change one, press **Run simulation**, compare.
- KPI cards + before/after table show Legacy vs PeakGuard compliance.
- Timeline charts: demand vs capacity, queue depth, latency vs the 300 ms SLO line.
- **Download results CSV** exports the comparison.
- Migration & rollback panel: promote to canary, then **ROLLBACK to legacy policy**;
  every action lands in the audit log.

## 3. Run everything headless

```bash
python simulator.py        # prints the full experiment table
python run_experiments.py  # writes outputs/experiment_results.csv + per-minute traces
python sensitivity.py      # writes outputs/sensitivity_results.csv
python generate_data.py    # regenerates data/historical_load.csv (seed=7)
pytest -q                  # 6 tests, all must pass
```

## 4. Reading the metrics

| Metric | Good | Bad |
|---|---|---|
| Availability | >= 99.9% | anything below during a scenario |
| P95 latency | < 300 ms | >= 300 ms = SLO breach |
| Breach minutes | 0-1 | sustained minutes above threshold |
| Failed transactions | ~0 | thousands during peaks |
| Worker-minutes | as low as possible | only meaningful against the SLO metrics |

## 5. Reproduce the report numbers

Defaults (4 start workers, 20 cap, 30 TPS/worker, 120 s warm-up), seed=1:
`python run_experiments.py` must reproduce the table in `docs/experiment_results.md`.

## 6. Troubleshooting

- `streamlit: command not found` -> `pip install -r requirements.txt` in the right venv.
- Port busy -> `streamlit run app.py --server.port 8502`.
- Import errors -> run from the repo root so `simulator.py` is importable.
- Different numbers -> you changed a slider or seed; reset to defaults and rerun.
