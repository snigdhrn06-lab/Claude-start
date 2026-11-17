# PULSE prototype. `make all` = fetch data, build, train/evaluate, test, screenshots.
PY ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)

.PHONY: all setup setup-app demo bench fetch-data data train test test-fast app screenshots presentation test-presentation clean

all: fetch-data data train test presentation screenshots

setup:
	python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
	@echo "If no Chromium is pre-installed: .venv/bin/playwright install chromium"

# Light install for the stall laptop: only what the app needs (no training libs beyond what pages import).
setup-app:
	python3 -m venv .venv && .venv/bin/pip install -r requirements-app.txt

# Offline stall demo: one command, opens Judge Mode at http://localhost:8501/present
demo:
	@test -x .venv/bin/python || $(MAKE) setup-app
	$(PY) scripts/demo.py

# Scoring API latency benchmark -> artifacts/eval/latency.json
bench:
	$(PY) -m pulse.scoring_api --bench 10000

fetch-data:
	$(PY) scripts/fetch_data.py

data:
	@test -f data/raw/bread_basket.csv || (echo "Missing data/raw/bread_basket.csv: run 'make fetch-data' or see README" && exit 1)
	$(PY) -m pulse.pipeline data

train:
	$(PY) -m pulse.pipeline train

test:
	$(PY) -m pytest -q

test-fast:
	$(PY) -m pytest -q -m "not slow"

app:
	$(PY) -m streamlit run app/Home.py

screenshots:
	$(PY) scripts/screenshots.py

presentation:
	$(PY) scripts/build_presentation.py

test-presentation:
	$(PY) scripts/test_presentation.py

clean:
	rm -rf data/processed artifacts/*.parquet artifacts/*.json artifacts/*.npz artifacts/evidence
