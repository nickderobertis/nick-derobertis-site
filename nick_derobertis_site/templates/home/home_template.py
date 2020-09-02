"""This module implements an ApplicationTemplate based on Material and the mwc-components"""
import pathlib

import panel as pn
import param

from nick_derobertis_site.common.container import Container
from nick_derobertis_site.common.services.common import Services
from nick_derobertis_site.footer.config import FOOTER_MODEL
from nick_derobertis_site.footer.footer_component import FooterComponent
from nick_derobertis_site.header.config import HEADER_MODEL
from nick_derobertis_site.header.header_component import HeaderComponent
from nick_derobertis_site.landing.config.page import LANDING_PAGE_MODEL
from nick_derobertis_site.landing.page.landing_page_component import LandingPageComponent

ROOT_PATH = pathlib.Path(__file__).parent
HTML_PATH = ROOT_PATH / "home_template.html"
CSS_PATH = ROOT_PATH / "home_template.css"
BASE_CSS_PATH = pathlib.Path('nick_derobertis_site') / 'styles.css'


class HomeTemplate(pn.Template):
    """
    A Template based on Bootstrap-Material design
    """
    services = param.ClassSelector(class_=Services)

    def __init__(self, **params):
        pn.config.sizing_mode = "stretch_width"

        params["template"] = HTML_PATH.read_text()
        pn.config.css_files.append(BASE_CSS_PATH.resolve())
        pn.config.css_files.append(CSS_PATH.resolve())

        if "services" not in params:
            params["services"] = Services()

        super().__init__(**params)
        self.main = Container(
            name="main", css_classes=["main"],
        )
        self._update_main_container()
        self.add_panel('main', self.main)
        self.header = Container(HeaderComponent(model=HEADER_MODEL, services=self.services), name='header')
        self.add_panel('header', self.header)
        self.footer = Container(FooterComponent(model=FOOTER_MODEL, services=self.services), name='footer')
        self.add_panel('footer', self.footer)

    @param.depends("services.page_service.page", watch=True)
    def _update_main_container(self):
        self.main[:] = [self.services.page_service.page]