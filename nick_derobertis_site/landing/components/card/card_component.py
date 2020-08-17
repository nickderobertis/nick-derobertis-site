import param
import panel as pn
from param.parameterized import Event

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.common.providers import HasPageService
from nick_derobertis_site.landing.components.card.card_model import CardModel


class CardComponent(HasPageService, HTMLComponent):
    model: CardModel = param.ClassSelector(class_=CardModel)

    def __init__(self, **params):
        self.button = pn.widgets.Button(name=params['model'].link_display_text, css_classes=['btn', 'btn-primary'])
        self.button.on_click(self.navigate_to_link)
        super().__init__(**params)

    def navigate_to_link(self, event: Event):
        self.page_service.navigate(self.model.link)
