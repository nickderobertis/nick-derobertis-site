import pathlib
import sys

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

from nick_derobertis_site.templates.home.home_template import HomeTemplate


def view() -> HomeTemplate:
    from nick_derobertis_site.service_config import SERVICES

    template = HomeTemplate(services=SERVICES)
    return template


if __name__.startswith("bokeh"):
    view().servable()