import pathlib
import sys

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

import param

from nick_derobertis_site.common.component import HTMLComponent


import panel as pn

component_template = """
<p>it works begin</p>
<div id="should-contain-the-items" style="background-color: blue">
    <p>some static content in the div before dynamic content</p>
    {{ embed(model.inp) }}
    {{ embed(model.button) }}
    <p>some static content in the div after dynamic content</p>
</div>
<p>it works end</p>
"""


class MyModel(param.Parameterized):
    button = param.ClassSelector(class_=pn.widgets.Button)
    inp = param.ClassSelector(class_=pn.widgets.TextInput)


class MyComp(HTMLComponent):
    model = param.ClassSelector(class_=MyModel)
    template_str = component_template


button = pn.widgets.Button(name="yeah")
inp = pn.widgets.TextInput(value=button.name)
inp.link(button, value="name")
model = MyModel(button=button, inp=inp)
view = MyComp(model=model, css_classes=['parent'], child_css_classes=['child'])

view.servable()
