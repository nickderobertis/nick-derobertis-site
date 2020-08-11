"""This module implements an ApplicationTemplate based on Material and the mwc-components"""
import pathlib

import panel as pn
import param

from nick_derobertis_site.landing.components.card.card import CardComponent

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

        self.add_panel(name='card', panel=CardComponent('My Heading', 'Some filler text', '', '#'))