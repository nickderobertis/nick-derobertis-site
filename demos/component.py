import pathlib
import sys

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

import param

from nick_derobertis_site.common.component import HTMLComponent


import panel as pn

sub_component_template = """
<p>subcomponent begin</p>
<div id="should-contain-the-subcomponent-items" style="background-color: blue">
    <p>some static content in the div before dynamic content</p>
    {{ embed(model.inp) }}
    {{ embed(model.button) }}
    <p>some static content in the div after dynamic content</p>
</div>
<p>subcomponent end</p>
"""

component_template = """
<p>it works begin</p>
<div id="contains-subcomponents">
    {% for comp in model.sub_components %}
        {{ embed(comp, css_classes=['subcomponent-parent']) }}
    {% endfor %}
</div>
<p>it works end</p>
"""


class MySubModel(param.Parameterized):
    button = param.ClassSelector(class_=pn.widgets.Button)
    inp = param.ClassSelector(class_=pn.widgets.TextInput)


class MySubComp(HTMLComponent):
    model = param.ClassSelector(class_=MySubModel)
    template_str = sub_component_template


class MyModel(param.Parameterized):
    sub_components = param.List(class_=MySubComp)


class MyComp(HTMLComponent):
    model = param.ClassSelector(class_=MyModel)
    template_str = component_template

sub_components = []
for i in range(3):
    button = pn.widgets.Button(name=f"yeah {i}")
    inp = pn.widgets.TextInput(value=button.name)
    inp.link(button, value="name")
    model = MySubModel(button=button, inp=inp)
    sub_comp = MySubComp(model=model, css_classes=['parent'], child_css_classes=['child'])
    sub_components.append(sub_comp)

model = MyModel(sub_components=sub_components)
view = MyComp(model=model)

view.servable()
