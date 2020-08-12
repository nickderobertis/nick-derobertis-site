"""This module implements an ApplicationTemplate based on Material and the mwc-components"""
import pathlib

import panel as pn

from nick_derobertis_site.landing.config.page import LANDING_PAGE_MODEL
from nick_derobertis_site.landing.page.landing_page_component import LandingPageComponent

ROOT_PATH = pathlib.Path(__file__).parent
HTML_PATH = ROOT_PATH / "home_template.html"
CSS_PATH = ROOT_PATH / "home_template.css"


class HomeTemplate(pn.Template):
    """
    A Template based on Bootstrap-Material design
    """

    def __init__(self, **params):
        pn.config.sizing_mode = "stretch_width"

        params["template"] = HTML_PATH.read_text()
        pn.config.css_files.append(CSS_PATH.resolve())

        super().__init__(**params)
        self.landing_page: LandingPageComponent = LandingPageComponent(LANDING_PAGE_MODEL)
        self.add_variable('landing_page', self.landing_page)