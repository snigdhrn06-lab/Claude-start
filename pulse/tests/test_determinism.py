"""Same seed -> identical artefacts (run on a reduced background population to keep the test fast)."""
import subprocess
import sys

import pytest

from conftest import ROOT, load_json


@pytest.mark.slow
def test_pipeline_is_deterministic(tmp_path):
    outs = []
    for k in range(2):
        a, p = tmp_path / f"art{k}", tmp_path / f"proc{k}"
        subprocess.run([sys.executable, "-m", "pulse.pipeline", "all", "--scale", "0.25", "--no-ablation",
                        "--out", str(a), "--proc", str(p)], cwd=ROOT, check=True, capture_output=True)
        outs.append(load_json(a / "manifest.json"))
    assert outs[0].keys() == outs[1].keys()
    diff = [k for k in outs[0] if outs[0][k] != outs[1][k]]
    assert not diff, f"artefacts differ between runs: {diff}"
