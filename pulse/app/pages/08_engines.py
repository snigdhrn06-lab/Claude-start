"""Engines lab (URL: /engines). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("Engines lab", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "engines_lab.py"), run_name="__main__")
