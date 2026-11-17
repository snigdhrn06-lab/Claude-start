"""Try to fool PULSE (URL: /sandbox). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("Try to fool PULSE", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "sandbox.py"), run_name="__main__")
