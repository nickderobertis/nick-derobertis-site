from dataclasses import dataclass
from typing import Sequence, List

from nick_derobertis_site.landing.components.card.card_component import CardComponent
from nick_derobertis_site.landing.components.card.card_model import CardModel


@dataclass
class LandingPageModel:
    card_models: Sequence[CardModel]

    @property
    def cards(self) -> List[CardComponent]:
        return [CardComponent(mod) for mod in self.card_models]