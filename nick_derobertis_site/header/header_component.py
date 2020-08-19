from functools import partial
from typing import List

import panel as pn
import param
from param.parameterized import Event

from nick_derobertis_site.common.component import HTMLComponent
from .header_model import HeaderModel
from nick_derobertis_site.common.providers import HasPageService
from nick_derobertis_site.general.widgets.button import PrimaryButton


class HeaderComponent(HasPageService, HTMLComponent):
    model = param.ClassSelector(class_=HeaderModel)
    page_buttons: List[PrimaryButton]

    def __init__(self, **params):
        self.page_buttons = []
        for page_name, page in self.page_service.routes.items():
            button = PrimaryButton(
                display_text=page.model.page_link_text, page_path=page_name
            )
            self.page_buttons.append(button)

        super().__init__(**params)

    def navigate_to_page(self, page_name: str, event: Event):
        self.page_service.navigate(page_name)




