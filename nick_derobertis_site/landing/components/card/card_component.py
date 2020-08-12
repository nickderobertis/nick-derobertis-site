from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.landing.components.card.card_model import CardModel


class CardComponent(HTMLComponent):

    def __init__(self, model: CardModel, **kwargs):
        self.model = model
        super().__init__(**kwargs)


