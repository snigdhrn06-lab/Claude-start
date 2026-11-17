"""2-minute film (URL: /film). Thin wrapper: shared setup, then the view."""
import pathlib
import runpy

from ui import layout

layout.setup("2-minute film", sidebar=True)  # sidebar links stay in the DOM so the film's Exit can navigate
runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / "views" / "presentation.py"), run_name="__main__")
