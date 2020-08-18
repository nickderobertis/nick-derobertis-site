import pathlib
from typing import Callable

from bokeh.core.has_props import HasProps
from bokeh import events
from bokeh.models import Widget
from bokeh.util.compiler import TypeScript
from bokeh.core.properties import (
    List,
    String,
    Seq,
)

TS_PATH = pathlib.Path(__file__).parent / "event_elem.ts"


class GeneralEvent(events.Event):
    """
    Any event
    """
    event_name: str = 'general_event'


class EventElement(Widget, HasProps):
    __implementation__ = TypeScript(TS_PATH.read_text())

    text = String(default="", help="""
        The text or HTML contents of the widget.

        .. note::
            If the HTML content contains elements which size depends on
            on external, asynchronously loaded resources, the size of
            the widget may be computed incorrectly. This is in particular
            an issue with images (``<img>``). To remedy this problem, one
            either has to set explicit dimensions using CSS properties,
            HTML attributes or model's ``width`` and ``height`` properties,
            or inline images' contents using data URIs.
        """)

    watch_events = List(
        String,
        help="""
        Names of events to watch
        """,
    ).accepts(Seq(String), lambda x: list(x))

    def on(self, event_type: str, handler: Callable):
        ''' Set up a handler for button clicks.

        Args:
            handler (func) : handler function to call when button is clicked.

        Returns:
            None

        '''
        self.on_event(event_type, handler)

    def js_on(self, event_type: str, handler: Callable):
        ''' Set up a JavaScript handler for button clicks. '''
        self.js_on_event(event_type, handler)
