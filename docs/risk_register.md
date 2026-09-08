# Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | Synthetic data differs from real gateway traffic | High | Medium | Label all data synthetic; CSV import path for real APM exports; test 4 distinct scenario shapes | Project author |
| 2 | Simplified latency model omits network/DB contention | Medium | Medium | Documented in error analysis; latency formula and constants exposed in one place for refinement | Project author |
| 3 | Forecast/seasonal assumption wrong (over/under-scale) | Medium | High | Sensitivity sweep quantifies both directions; 30% utilisation headroom absorbs moderate under-forecast | SRE (production) |
| 4 | Slow provisioning (warm-up) defeats reactive scaling | High | High | Measured: 300 s warm-up makes unannounced-spike SLO impossible -> pre-scaling or hot standby pool | SRE (production) |
| 5 | Fleet cap too low for the peak (capacity exhaustion) | Medium | High | Simulator reports exhaustion honestly instead of hiding it; decision output includes required cap | Finance + SRE |
| 6 | Worker failure during peak | Medium | High | worker_loss scenario; replacement scaling; keep reserve headroom | SRE (production) |
| 7 | Retry storms amplify an outage | Medium | Medium | Out of MVP scope; listed as future work with idempotency-key design | Product |
| 8 | Unsafe automated policy rollout | Low | High | Shadow mode -> advisory -> canary (10%) -> guarded rollout; auto-rollback guardrails (P95 > 300 ms for 3 min, availability < 99.9%); audit log | Ops manager |
| 9 | Privacy: payment data exposure | Low (MVP: none) | Critical | No cardholder/merchant/PII anywhere; synthetic generator only; no secrets in repo | Project author |
| 10 | Evaluator cannot reproduce results | Low | Medium | Fixed seeds; pinned requirements; pytest suite; one-command runners | Project author |

## Residual risk statement

The MVP intentionally trades model fidelity for transparency. Every simplification is
documented, and the sensitivity analysis shows which assumptions change the capacity
decision — so the residual risk is understood rather than hidden.
