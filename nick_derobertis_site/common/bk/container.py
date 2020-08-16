import pathlib

from bokeh.models import Box
from bokeh.models.layouts import QuickTrackSizing, IntOrString, RowSizing, LayoutDOM
from bokeh.util.compiler import TypeScript
from bokeh.core.properties import (
    Dict,
    Either,
    List,
    Tuple,
    Int,
    Instance,
)

TS_PATH = pathlib.Path(__file__).parent / "container.ts"


class Container(Box):
    __implementation__ = TypeScript(TS_PATH.read_text())
