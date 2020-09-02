from typing import Any, Dict

import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.general.widgets.button import PrimaryButton
from nick_derobertis_site.landing.components.card.card_model import CardModel


class CardComponent(HTMLComponent):
    model: CardModel = param.ClassSelector(class_=CardModel)

    def __init__(self, **params):
        self.button = PrimaryButton(
            display_text=params["model"].link_display_text, page_path=params["model"].link
        )
        super().__init__(**params)
