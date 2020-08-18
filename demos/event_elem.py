import pathlib
import sys

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

import panel as pn
from nick_derobertis_site.common.event_elem import EventElement
from nick_derobertis_site.common.container import Container

event_elem = EventElement(text='<p>my event element</p>', watch_events=['click'])
# event_elem = pn.widgets.Button(name='woo')
disp = pn.widgets.IntSlider(start=0, end=10, value=event_elem.clicks)
event_elem.link(disp, clicks='value')
view = pn.Column(
    event_elem,
    disp
)

view.servable()