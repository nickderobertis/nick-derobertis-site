from functools import partial
from typing import List

import panel as pn
import param
from param.parameterized import Event

from nick_derobertis_site.common.component import HTMLComponent
from .header_model import HeaderModel
from ..common.providers import HasPageService


class HeaderComponent(HasPageService, HTMLComponent):
    model = param.ClassSelector(class_=HeaderModel)
    page_buttons: List[pn.widgets.Button]

    def __init__(self, **params):
        self.page_buttons = []
        for page_name in self.page_service.routes.keys():
            button = pn.widgets.Button(name=page_name)
            button.on_click(partial(self.navigate_to_page, page_name))
            self.page_buttons.append(button)

        super().__init__(**params)

    def navigate_to_page(self, page_name: str, event: Event):
        self.page_service.navigate(page_name)




