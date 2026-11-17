"""Evaluation (URL: /evaluation). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("Evaluation", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "evaluation.py"), run_name="__main__")
