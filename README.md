# PeakGuard — Peak-Demand Capacity Simulator

A scenario-driven capacity simulator for a payment gateway with strict latency and availability
commitments. Instead of planning from **average utilisation**, it replays workload scenarios
(seasonal sales, sudden spikes, worker failures) and compares a legacy reactive autoscaling
policy with a scenario-aware policy, quantifying service-level compliance under peak demand.

**All data is synthetic. This is a capacity decision simulator, not a payment processor.
No cardholder, merchant, or personally identifiable data is used anywhere.**

## Quick start (Windows / VS Code)

1. Open this folder in VS Code (`File -> Open Folder...`).
2. Double-click `run_app.bat` **or** use the terminal:

```bash
pip install -r requirements.txt
python app.py
```
This launches the modern dark glassmorphic HTML/CSS/JS web dashboard at `http://127.0.0.1:5000`.


3. Reproduce every number in the report:

```bash
run_all.bat          # Windows
# or manually:
python generate_data.py
python run_experiments.py
python sensitivity.py
pytest -q
```

Runs on any modest laptop; deployable to Streamlit Community Cloud or Render free tier.

## SLOs under test

- Latency: 95% of served transactions under **300 ms**
- Availability: **99.9%** of arrived transactions succeed
- Transactions time out at 1000 ms wait; scale-out warm-up 120 s; fleet cap 20 workers

## Verified experiment results (defaults, seed=1)

| Scenario | Policy | Availability | P95 latency | SLO breach | Failed txns | Worker-min |
|---|---|---:|---:|---:|---:|---:|
| normal_day | Legacy | 100.00% | 113 ms | 0 min | 0 | 284.5 |
| normal_day | PeakGuard | 100.00% | 113 ms | 0 min | 0 | 298.0 |
| scheduled_sale (5x) | Legacy | 67.94% | 1004 ms | 10 min | 173,195 | 358.5 |
| scheduled_sale (5x) | PeakGuard | 100.00% | 113 ms | 0 min | 0 | 578.3 |
| sudden_spike (6x) | Legacy | 74.88% | 998 ms | 5 min | 115,303 | 351.5 |
| sudden_spike (6x) | PeakGuard | 87.37% | 521 ms | 3 min | 57,991 | 437.3 |
| worker_loss (3x + 30% loss) | Legacy | 80.78% | 1004 ms | 10 min | 83,026 | 338.5 |
| worker_loss (3x + 30% loss) | PeakGuard | 100.00% | 116 ms | 1.2 min | 0 | 437.3 |

Sensitivity highlights (docs/experiment_results.md): 300 s warm-up makes unannounced-spike
compliance impossible; a 10-worker fleet cap defeats even perfect pre-scaling (82.95%);
fewer bigger workers (40 TPS) are compliant AND cheapest (327.7 worker-min).

## Repository layout

```text
peakguard-capacity-simulator/
├── app.py                  # Flask web server & REST API (serves index.html, styles.css, app.js)
├── index.html              # HTML5 modern dashboard structure
├── styles.css              # Custom dark glassmorphic CSS design system
├── app.js                  # Interactive Chart.js frontend controller & client fallback engine
├── simulator.py            # Engine + Legacy/PeakGuard policies + scenarios
├── generate_data.py        # Synthetic 30-day historical load generator
├── run_experiments.py      # Full experiment runner -> outputs/
├── sensitivity.py          # Sensitivity sweeps -> outputs/
├── test_simulator.py       # 6 pytest tests
├── requirements.txt
├── run_app.bat / run_all.bat
├── data/historical_load.csv
├── outputs/                # Pre-generated results + per-minute traces
└── docs/                   # assumptions, architecture, schema, results,
                            # risk register, user guide, validation, coverage map
```

## Ethics note

Synthetic workload only; no real payment data. Every scaling recommendation is explainable
(trigger, inputs, timestamp). A human operator retains override and rollback control.
