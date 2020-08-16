from typing import List

import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.landing.components.card.card_component import CardComponent
from nick_derobertis_site.landing.components.card.card_model import CardModel


class LandingPageModel(ComponentModel):
    card_models = param.List(class_=CardModel)
    cards = param.List(class_=CardComponent)

    def __init__(self, **params):
        super().__init__(**params)
        self._set_cards()

    @param.depends('card_models', watch=True)
    def _set_cards(self):
        self.cards = [CardComponent(model=mod) for mod in self.card_models]