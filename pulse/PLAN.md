# PULSE prototype: build plan

PULSE is a pattern-of-life engine that spots a merchant drifting away from its declared business.
This repo folder is self-contained: `pulse/` sits beside the existing shop app and shares nothing with it.

## File layout

```
pulse/
  config/            settings, engines, scenarios, merchant templates, price list, costs (all design parameters)
  data/raw/          bread_basket.csv (real, fetched + checksum-verified), optional partner_bakery.csv
  data/events/       festivals.csv, fixtures.csv
  pulse/             Python package
    ingest.py        Bread Basket -> UPI-style payment stream for the hero bakery
    simulate.py      region (3 cities), 50k payers, ~300 merchants, scenarios S0-S5/E1-E3, extra fronts
    calendar.py      fixtures -> match windows and live-match moments (hourly masks)
    features.py      hourly tensors, baselines, peer groups (HDBSCAN), feature table
    engines/         drift.py peers.py invariants.py graph.py
    fusion.py        Stage A scorecard, Stage B LightGBM (monotone), Stage C isotonic, SHAP, reasons
    response.py      ladder, corroboration, decision rule, delta reserve, earned trust, evidence pack
    evaluate.py      metrics, ablation, fairness, scenario scorecard
    pipeline.py      end-to-end; writes artifacts/
  app/               Streamlit: Home.py (Story mode) + pages/, ui/theme.py, ui/components.py
  tests/             pytest
  scripts/           fetch_data.py, screenshots.py
  artifacts/         generated (parquet/json); eval/ and screenshots/ kept in git
```

## Milestones (each one is tested before the next starts)

1. **Data**: fetch and verify Bread Basket; price list; ingest to a payment stream; fixtures and festivals files.
2. **Simulation**: payer pool, merchants from templates, honest hard negatives, fronts and scenarios with ground truth.
3. **Engines**: hourly tensors, then drift, peers, invariants and graph, each with hand-built unit tests.
4. **Fusion**: scorecard, LightGBM with monotonic constraints, isotonic calibration, SHAP reasons, corroboration and decision rule.
5. **Response**: ladder over time, delta reserve, earned trust, evidence pack (Markdown).
6. **Evaluation**: train/test split by merchant, metrics, ablation, fairness, scenario scorecard, REPORT.md.
7. **App**: theme, Story mode (7 steps), 6 more pages; all reading precomputed artefacts.
8. **Screenshots**: Playwright captures every page and story step; review and fix by eye.
9. **Docs**: README, ASSUMPTIONS, DEMO_SCRIPT; `make all` timed from a clean state.

## Key design decisions

- One hourly grid for the whole window. Every feature is a trailing window ending at an hour,
  so the daily evaluation snapshot (hour 23) and the live hourly view use the same definitions.
- Heavy work happens once in the pipeline. The app only reads artefacts through `st.cache_data`.
- Scenario merchants are always in the **test** set. Thresholds and costs are tuned on training merchants only.
- "Flag" means reaching ladder level L2 or above (needs two engines to agree).
