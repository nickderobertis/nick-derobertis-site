import pathlib
import sys

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

import panel as pn
from nick_derobertis_site.common.event_elem import EventElement

event_elem = EventElement(text='<p>my event element</p>', watch_events=['pointerover', 'click'])
disp_hover = pn.widgets.IntSlider(start=0, end=10, value=event_elem.events.pointerover)
disp_click = pn.widgets.IntSlider(start=0, end=10, value=event_elem.events.click)
events = event_elem.events
events.link(disp_hover, pointerover='value')
events.link(disp_click, click='value')
view = pn.Column(
    event_elem,
    disp_hover,
    disp_click,
    events.param,
)

view.servable()