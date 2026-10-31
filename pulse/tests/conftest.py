import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
ART = ROOT / "artifacts"


@pytest.fixture(scope="session")
def art():
    if not (ART / "eval" / "scenario_scorecard.json").exists():
        pytest.skip("artifacts not built; run `make train` first")
    return ART


def load_json(p):
    return json.loads(pathlib.Path(p).read_text())
