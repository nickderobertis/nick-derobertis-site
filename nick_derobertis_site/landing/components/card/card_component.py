from typing import Any, Dict

import param
import panel as pn
from param.parameterized import Event

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.common.event_elem import EventElement
from nick_derobertis_site.common.providers import HasPageService
from nick_derobertis_site.landing.components.card.card_model import CardModel


class CardComponent(HasPageService, HTMLComponent):
    model: CardModel = param.ClassSelector(class_=CardModel)

    def __init__(self, **params):
        self.button = EventElement(text=self._button_html(params), watch_events=['click'])
        self.button.on('click', self.navigate_to_link)
        super().__init__(**params)


    def navigate_to_link(self, event: Event):
        self.page_service.navigate(self.model.link)

    def _button_html(self, params: Dict[str, Any]) -> str:
        return f'<button class="btn btn-primary">{params["model"].link_display_text}</button>'