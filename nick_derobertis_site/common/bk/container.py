import pathlib

from bokeh.models import Box
from bokeh.models.layouts import QuickTrackSizing, IntOrString, RowSizing
from bokeh.util.compiler import TypeScript
from bokeh.core.properties import (
    Dict,
    Either,
)

TS_PATH = pathlib.Path(__file__).parent / 'container.ts'


class Container(Box):
    __implementation__ = TypeScript(TS_PATH.read_text())

    rows = Either(QuickTrackSizing, Dict(IntOrString, RowSizing), default="auto", help="""
        Describes how the component should maintain its rows' heights.

        .. note::
            This is an experimental feature and may change in future. Use it at your
            own discretion.

        """)
