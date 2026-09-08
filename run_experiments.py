"""Runs the full experiment matrix: every scenario x both policies.

Writes outputs/experiment_results.csv (metrics) and outputs/trace_<scenario>_<policy>.csv
(per-minute timelines used for charts). Deterministic: seed=1.
"""
import os

import pandas as pd

from simulator import POLICIES, SCENARIOS, run_scenario


def main():
    os.makedirs("outputs", exist_ok=True)
    rows = []
    for name in SCENARIOS:
        res = run_scenario(name)
        for label in POLICIES:
            rows.append(dict(scenario=name, policy=label, **res[label]["metrics"]))
            res[label]["trace"].to_csv(f"outputs/trace_{name}_{label.lower()}.csv", index=False)
    df = pd.DataFrame(rows)
    df.to_csv("outputs/experiment_results.csv", index=False)
    print(df.to_string(index=False))
    print("\nwrote outputs/experiment_results.csv +", len(SCENARIOS) * len(POLICIES), "trace files")


if __name__ == "__main__":
    main()
