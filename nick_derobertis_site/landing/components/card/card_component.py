import param
import panel as pn
from param.parameterized import Event

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.common.services.common import get_default_services
from nick_derobertis_site.common.services.page import PageService
from nick_derobertis_site.landing.components.card.card_model import CardModel


class CardComponent(HTMLComponent):
    model: CardModel = param.ClassSelector(class_=CardModel)
    _page_service: PageService = param.ClassSelector(class_=PageService)
    exclude_attrs = ('_page_service', 'page_service')

    def __init__(self, **params):
        self.button = pn.widgets.Button(name=params['model'].link_display_text, css_classes=['btn', 'btn-primary'])
        self.button.on_click(self.navigate_to_link)
        super().__init__(**params)

    def navigate_to_link(self, event: Event):
        self.page_service.navigate(self.model.link)

    @property
    def page_service(self) -> PageService:
        breakpoint()
        if self._page_service is None:
            self._page_service = get_default_services().page_service
        return self._page_service
