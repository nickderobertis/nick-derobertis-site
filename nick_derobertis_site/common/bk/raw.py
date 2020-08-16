import pathlib

from bokeh.models import Markup
from bokeh.util.compiler import TypeScript

TS_PATH = pathlib.Path(__file__).parent / "raw.ts"


class Raw(Markup):
    __implementation__ = TypeScript(TS_PATH.read_text())
