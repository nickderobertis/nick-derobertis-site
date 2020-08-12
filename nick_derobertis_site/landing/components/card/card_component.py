import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.landing.components.card.card_model import CardModel


class CardComponent(HTMLComponent):
    model = param.ClassSelector(class_=CardModel)


