from typing import Any, Dict

import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.general.widgets.button import PrimaryButton, ButtonModel
from nick_derobertis_site.landing.components.card.card_model import CardModel


class CardComponent(HTMLComponent):
    model: CardModel = param.ClassSelector(class_=CardModel)

    def __init__(self, **params):
        button_model = ButtonModel(display_text=params["model"].link_display_text, page_path=params["model"].link)
        self.button = PrimaryButton(
            model=button_model,
            services=params['services']
        )
        super().__init__(**params)
