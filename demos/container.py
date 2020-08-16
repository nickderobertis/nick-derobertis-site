import pathlib
import sys

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

import panel as pn

from nick_derobertis_site.common.container import Container

button = pn.widgets.Button(name='yeah')
inp = pn.widgets.TextInput(value=button.name)
inp.link(button, value='name')
view = Container(
    pn.pane.HTML('<p>it works begin</p>'),
    inp,
    button,
    pn.pane.HTML('<p>it works end</p>'),
    css_classes=['parent1', 'parent2'],
    child_css_classes=['child1', 'child2'],
)

view.servable()