# Architecture

## Component diagram

```mermaid
flowchart TD
    A["historical_load.csv<br/>30 days synthetic per-minute load"] --> B["Workload generator<br/>demand_series(): diurnal + events + noise"]
    E["Seasonal events & incidents<br/>sale / spike / worker loss"] --> B
    B --> C["Discrete-time engine (1 s steps)<br/>arrivals -> queue -> worker pool -> responses"]
    C --> D["Signals: queue depth, utilisation,<br/>demand history, active workers"]
    D --> P1["Legacy policy<br/>5-min avg utilisation, +1 worker, 300 s cooldown"]
    D --> P2["PeakGuard policy<br/>event pre-scaling + backlog/worker > 25 batch scale"]
    P1 -- "scale commands (120 s warm-up)" --> C
    P2 -- "scale commands (120 s warm-up)" --> C
    C --> M["SLA evaluator<br/>availability, P50/P95 latency, breach minutes,<br/>failed txns, worker-minutes"]
    M --> UI["Streamlit dashboard<br/>KPI cards, timelines, before/after table, CSV export"]
    UI --> R["Migration & rollback panel<br/>shadow -> canary -> rollback, audit log"]
    M --> X["outputs/*.csv<br/>experiment + sensitivity results"]
```

## Components

| Component | File | Responsibility |
|---|---|---|
| Simulation engine | `simulator.py` | 1-second discrete simulation of arrivals, queue, workers, timeouts, warm-up, failures |
| Policies | `simulator.py` (`legacy_policy`, `peakguard_policy`) | Map signals to scale actions; identical warm-up and fleet cap for fair comparison |
| Scenario library | `simulator.py` (`SCENARIOS`) | normal_day, scheduled_sale, sudden_spike, worker_loss |
| Data generator | `generate_data.py` | Reproducible 30-day synthetic historical load |
| Experiment runner | `run_experiments.py` | Full scenario x policy matrix -> CSV |
| Sensitivity runner | `sensitivity.py` | One-at-a-time assumption sweeps -> CSV |
| Dashboard | `app.py` | Scenario picker, sensitivity sliders, KPI cards, timeline charts, rollback demo |
| Tests | `test_simulator.py` | 6 pytest tests: behaviour, caps, reproducibility, invariants |

## Data flow

1. `demand_series` builds a per-second TPS profile from base load + event multipliers.
2. Each second: arrivals enter the queue; workers process up to capacity; transactions whose
   wait would exceed 1000 ms are counted failed; latency is recorded from carried backlog.
3. Every 30 s the active policy observes signals and may issue a scale command; new workers
   become active only after the warm-up delay.
4. Metrics aggregate to availability, P95 latency, breach minutes, max queue, failures,
   worker-minutes; per-minute traces feed the dashboard charts.

## Deployment

- Local: `streamlit run app.py` (any modest laptop; no GPU, no external services).
- Free tier: Streamlit Community Cloud or Render (single process, no database).
- No secrets, credentials, or network calls required anywhere in the system.
