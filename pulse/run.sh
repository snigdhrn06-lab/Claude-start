#!/usr/bin/env bash
# PULSE on macOS/Linux without make. Usage: ./run.sh setup|all|data|train|test|app|screenshots
set -e
cd "$(dirname "$0")"
PY=.venv/bin/python
case "$1" in
  setup) python3.11 -m venv .venv && $PY -m pip install -r requirements.txt && $PY -m playwright install chromium ;;
  data) $PY scripts/fetch_data.py && $PY -m pulse.pipeline data ;;
  train) $PY -m pulse.pipeline train ;;
  test) $PY -m pytest -q ;;
  screenshots) $PY scripts/screenshots.py ;;
  app) $PY -m streamlit run app/Home.py ;;
  all) "$0" data && "$0" train && "$0" test && "$0" screenshots ;;
  *) echo "Usage: ./run.sh setup|all|data|train|test|app|screenshots"; exit 1 ;;
esac
