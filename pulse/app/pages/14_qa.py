"""Ask us anything (URL: /qa). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("Ask us anything", sidebar=True)
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "qa.py"), run_name="__main__")
