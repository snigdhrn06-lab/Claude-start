"""Write artifacts/presentation.html: the cinematic presentation as one self-contained file
(works offline from a laptop; fonts fall back to system fonts without internet)."""
import logging
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))
logging.disable(logging.WARNING)
from ui import presentation_data  # noqa: E402

out = ROOT / "artifacts" / "presentation.html"
out.write_text(presentation_data.html())
print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
