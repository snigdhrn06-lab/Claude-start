"""Merchant explorer (URL: /explorer). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("Merchant explorer", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "explorer.py"), run_name="__main__")
