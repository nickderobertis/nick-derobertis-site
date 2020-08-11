import os
from sys import platform

import panel as pn

from nick_derobertis_site.templates.home.home_template import HomeTemplate


def view() -> HomeTemplate:
    template = HomeTemplate()
    return template


if __name__.startswith("bokeh"):
    view().servable()