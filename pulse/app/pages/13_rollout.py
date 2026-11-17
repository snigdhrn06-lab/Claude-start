"""Rollout & rules vs PULSE (URL: /rollout). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("Rollout & rules vs PULSE", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "rollout.py"), run_name="__main__")
