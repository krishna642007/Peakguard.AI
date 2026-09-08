# Data Schema

## `data/historical_load.csv` (43,200 rows, one per minute, 30 days)

| Column | Type | Description |
|---|---|---|
| timestamp | datetime | Minute bucket (2026-08-01 to 2026-08-30) |
| requests_per_second | float | Arrival rate in that minute |
| successful_requests | int | Transactions completed |
| failed_requests | int | Transactions failed/timed out |
| avg_latency_ms | float | Mean latency of served transactions |
| p95_latency_ms | float | P95 latency of served transactions |
| queue_depth | int | Transactions waiting at minute end |
| active_workers | int | Workers online (legacy fixed fleet) |
| seasonal_event | str | normal / salary_day / festival_sale / flash_sale |
| incident_flag | int | 1 during the injected capacity-loss window |

Embedded events: salary_day (day 1, 09:00-10:00, 2.2x), festival_sale (day 14, 19:00-20:00,
5x, with 30% capacity loss 19:10-19:25), flash_sale (day 21, 12:00-12:30, 3.5x).
Dataset fingerprint: overall availability 99.43%, but festival-hour availability 40.00%
— the "averages hide peaks" evidence.

## Scenario configuration (in code, `SCENARIOS` / overrides)

| Field | Type | Description |
|---|---|---|
| duration | int | Simulation length (minutes) |
| base_tps | float | Baseline arrival rate |
| events | list | start_min, duration_min, multiplier, known (pre-scalable) |
| failure | dict/null | minute, fraction, duration_min of worker loss |
| start_workers / max_workers | int | Fleet floor and cap |
| worker_tps | int | Per-worker throughput |
| warmup_s | int | Scale-out provisioning delay |

## Per-minute trace (`outputs/trace_<scenario>_<policy>.csv`)

| Column | Description |
|---|---|
| minute | Simulation minute |
| tps | Arrivals that second-sample |
| queue | Queue depth at sample time |
| workers | Active workers |
| pending | Workers in warm-up |
| lat_ms | Sampled latency |

## Metrics record (`outputs/experiment_results.csv`)

| Field | Description |
|---|---|
| availability | 100 x served / arrived (%) |
| p95_latency | 95th percentile latency of served transactions (ms) |
| max_queue | Peak queue depth |
| breach_minutes | Seconds with latency over 300 ms SLO, converted to minutes |
| worker_minutes | Cost proxy: sum of active workers over time |
| failed / arrived | Transaction counts |

## Sensitivity record (`outputs/sensitivity_results.csv`)

scenario, policy, variable, value, all metrics above, plus `meets_slo`
(availability >= 99.9% and breach_minutes <= 1.0).
