"""Data & assumptions (URL: /data). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("Data & assumptions", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "data_assumptions.py"), run_name="__main__")
