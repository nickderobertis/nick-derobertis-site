import param

from nick_derobertis_site.landing.components.card.card_component import CardComponent
from nick_derobertis_site.landing.components.card.card_model import CardModel
from nick_derobertis_site.common.page_model import PageModel


class LandingPageModel(PageModel):
    card_models = param.List(class_=CardModel)
    cards = param.List(class_=CardComponent)

    def __init__(self, **params):
        super().__init__(**params)
        self._set_cards()

    @param.depends('card_models', watch=True)
    def _set_cards(self):
        self.cards = [CardComponent(model=mod) for mod in self.card_models]