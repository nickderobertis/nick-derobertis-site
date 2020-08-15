import pathlib
import sys

ROOT_PATH = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_PATH))

from nick_derobertis_site.common.services.common import Services
from nick_derobertis_site.templates.home.home_template import HomeTemplate
from nick_derobertis_site import page_config as pc


def view() -> HomeTemplate:
    services = Services()

    services.page_service.set_default_page(pc.LANDING_PAGE)
    services.page_service.bulk_create(pc.PAGES)
    services.page_service.param.page.objects = pc.PAGES
    services.page_service.param.page.default = pc.LANDING_PAGE
    services.page_service.page = pc.LANDING_PAGE

    template = HomeTemplate(services=services)
    return template


if __name__.startswith("bokeh"):
    view().servable()