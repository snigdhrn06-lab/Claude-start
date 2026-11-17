"""PULSE prototype app. Run: streamlit run app/Home.py

The root URL and /present both open Judge Mode home. Pages live in app/pages/ (classic multipage layout, so a direct
visit to any URL, such as the poster QR's /present, loads without a "Page not found" pop-up).
"""
import pathlib
import runpy

from ui import layout

layout.setup("Judge Mode")
runpy.run_path(str(pathlib.Path(__file__).resolve().parent / "views" / "judge_home.py"), run_name="__main__")
