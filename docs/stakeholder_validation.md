# Stakeholder Validation

## Method

5 evaluators (3 CS classmates, 1 faculty mentor, 1 developer friend) were given the dashboard
and a 10-minute task script, then answered a 5-question survey (Yes / Partly / No).
Evaluators are volunteers giving usability feedback on a student prototype — they are not
presented as payment-industry employees, and no personal data was collected.

## Task script

1. Run the scheduled_sale scenario and identify whether the legacy policy meets its SLOs.
2. Find why PeakGuard scaled out before minute 15.
3. Use the sliders: raise warm-up to 300 s on sudden_spike and state what changes.
4. Perform a rollback to the legacy policy and point to the audit entry.
5. Say what extra information you would want before trusting this for a real rollout.

## Survey and results

| # | Question | Yes | Partly | No |
|---|---|---|---|---|
| 1 | Could you tell whether the gateway was meeting its latency/availability SLOs? | 5 | 0 | 0 |
| 2 | Was the reason for each scaling action understandable? | 4 | 1 | 0 |
| 3 | Was the before/after (Legacy vs PeakGuard) difference clear? | 5 | 0 | 0 |
| 4 | Was the rollback path clear enough to trust a canary rollout? | 4 | 1 | 0 |
| 5 | Would you trust fully automatic scaling without a human override? | 1 | 1 | 3 |

## Feedback incorporated

- Q2 ("Partly"): scale reasons now shown as text near the charts (event pre-scale vs
  backlog trigger) instead of only in code.
- Q4 ("Partly"): added explicit guardrail text above the rollback button and kept the
  audit table permanently visible.
- Q5 (mostly "No"): this directly justifies the phased design — shadow mode, advisory,
  canary, guarded auto — with a human override retained. Recorded as a design decision,
  not just a survey result.

## Requested improvements (future work)

- Per-merchant traffic breakdown.
- A "what-if" cost estimate in currency, not only worker-minutes.
- Alert sound/banner when the SLO line is crossed during a live demo.

## Conclusion

Evaluators could complete all tasks, correctly identified SLO breaches and their causes,
and validated the core design choice (phased rollout with rollback) — 4/5 would not trust
unattended automation, matching the shadow -> canary -> rollback architecture.
