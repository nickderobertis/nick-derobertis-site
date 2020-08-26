from functools import partial
from typing import List

import panel as pn
import param
from param.parameterized import Event

from nick_derobertis_site.common.component import HTMLComponent
from .header_model import HeaderModel
from ..common.providers.page_service import HasPageService
from nick_derobertis_site.general.widgets.button import NarrowPrimaryButton, NarrowPrimaryPDFButton
from ..common.event_elem import EventElement


class HeaderComponent(HasPageService, HTMLComponent):
    model = param.ClassSelector(class_=HeaderModel)
    page_buttons: List[NarrowPrimaryButton]
    cv_button: NarrowPrimaryPDFButton
    logo = param.ClassSelector(class_=EventElement)

    def __init__(self, **params):
        logo_src = params['model'].logo_src + '<a class="navbar-brand" href="#">Nick DeRobertis</a>'
        params['logo'] = EventElement(text=logo_src, watch_events=['click'])
        self.page_buttons = []
        for page_name, page in self.page_service.routes.items():
            button = NarrowPrimaryButton(
                display_text=page.model.page_link_text, page_path=page_name
            )
            self.page_buttons.append(button)
        self.cv_button = NarrowPrimaryPDFButton(display_text='CV', pdf_src=params['model'].pdf_src)
        super().__init__(**params)
        self.logo.on('click', self.navigate_to_home)

    def navigate_to_page(self, page_name: str, event: Event):
        self.page_service.navigate(page_name)

    def navigate_to_home(self, event: Event):
        self.page_service.navigate('home')




