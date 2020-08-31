import os
import pathlib
import sys

import panel as pn

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

from nick_derobertis_site.templates.home.home_template import HomeTemplate


def view() -> HomeTemplate:
    from nick_derobertis_site.service_config import SERVICES

    template = HomeTemplate(services=SERVICES)
    return template


if __name__.startswith("bokeh"):
    view().servable()
else:
    address = os.getenv("BOKEH_ADDRESS", "0.0.0.0")
    APP_ROUTES = {"": view}
    pn.serve(
        APP_ROUTES,
        port=5100,
        dev=False,
        title="Nick DeRobertis' Personal Site",
        address=address,
        num_procs=4,
    )