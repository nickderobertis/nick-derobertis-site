"""This module implements an ApplicationTemplate based on Material and the mwc-components"""
import pathlib
from typing import List

import panel as pn
import param

from nick_derobertis_site.landing.components.card.card_component import CardComponent
from nick_derobertis_site.landing.config.cards import LANDING_CARD_MODELS

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
        self.cards: List[CardComponent] = [CardComponent(model) for model in LANDING_CARD_MODELS]
        self.add_variable('cards', self.cards)