import param

from nick_derobertis_site.common.component import HTMLComponent
from .story_page_model import StoryPageModel


class StoryPageComponent(HTMLComponent):
    model = param.ClassSelector(class_=StoryPageModel)


