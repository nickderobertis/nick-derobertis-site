import param
from bokeh.events import Event

from nick_derobertis_site.common.component import HTMLComponent
from .story_page_model import StoryPageModel
from nick_derobertis_site.common.event_elem import EventElement
from ..common.providers.page_service import HasPageService


class StoryPageComponent(HasPageService, HTMLComponent):
    model = param.ClassSelector(class_=StoryPageModel)
    software_link = param.ClassSelector(class_=EventElement)

    def __init__(self, **params):
        params['software_link'] = EventElement(text='<a href="#">many of these tools.</a>', watch_events=['click'])
        super().__init__(**params)
        self.software_link.on('click', self.navigate_to_software_page)

    def navigate_to_software_page(self, event: Event):
        self.page_service.navigate('software')
