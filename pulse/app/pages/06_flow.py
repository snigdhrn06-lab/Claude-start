"""PayU flow, API & ops (URL: /flow). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("PayU flow, API & ops", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "flow.py"), run_name="__main__")
