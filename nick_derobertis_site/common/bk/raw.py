import pathlib

from bokeh.models import Box, Markup
from bokeh.util.compiler import TypeScript
from bokeh.core.properties import (
    List,
    String,
    Seq,Bool,
)

TS_PATH = pathlib.Path(__file__).parent / "raw.ts"


class Raw(Markup):
    __implementation__ = TypeScript(TS_PATH.read_text())

    render_as_text = Bool(False, help="""
        Whether the contents should be rendered as raw text or as interpreted HTML.
        The default value is ``False``, meaning contents are rendered as HTML.
        """)
