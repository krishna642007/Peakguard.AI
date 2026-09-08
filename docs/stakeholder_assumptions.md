# Stakeholder Assumptions

## Stakeholders and needs

| Stakeholder | Need | How the prototype serves it |
|---|---|---|
| Payment operations manager | Avoid SLA breaches without permanent overprovisioning | Dashboard with SLO compliance, breach minutes, cost proxy |
| SRE / DevOps engineer | Understandable, tunable scaling rules | Editable thresholds, warm-up delay, fleet cap; every scale action logged |
| Finance / platform owner | Control infrastructure cost | Worker-minutes reported per policy per scenario |
| Legacy operations team | No abrupt replacement of existing autoscaling | Shadow mode, canary promotion, one-click rollback with audit log |
| Merchant / end customer | Fast, reliable payments during peaks | Availability %, P95 latency, failed transaction counts |

## Operating assumptions

| Assumption | Value | Basis |
|---|---|---|
| Latency SLO | 95% of served transactions < 300 ms | Typical strict API gateway commitment |
| Availability SLO | 99.9% of arrived transactions succeed | Industry "three nines" tier |
| Transaction timeout | 1000 ms wait | Client-side timeout assumption |
| Base processing time | 100 ms per transaction | Auth + fraud check + ledger write |
| Worker capacity | 30 TPS per worker | Single-node throughput assumption |
| Scale-out warm-up | 120 s | Container/VM provisioning delay |
| Fleet cap | 20 workers | Cost ceiling set by finance |
| Baseline demand | ~90 TPS average, midday-peaked diurnal | Synthetic historical_load.csv |
| Evaluation cadence | Policies evaluated every 30 s | Matches typical autoscaler loop |

## Modelling assumptions (declared limits)

- Single shared FIFO queue; no per-merchant partitioning in the MVP.
- Latency = base processing + queued backlog / capacity; Gaussian jitter +/-8 ms.
- Timed-out transactions are counted failed; client retries are out of scope (future work).
- All workload data is synthetic (seeded generator); no real payment data is used.
- Worker-minutes are a cost proxy, not a billing model.

## Open questions for a production version

- Real per-endpoint latency distributions from APM tooling.
- Multi-region capacity and failover behaviour.
- Client retry policy and idempotency keys (retry-storm amplification).
- Pricing-based throttling / merchant tiering policy.
