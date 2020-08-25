import param

from nick_derobertis_site.common.component import HTMLComponent
from .story_highlight_pane_model import StoryHighlightPaneModel


class StoryHighlightPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=StoryHighlightPaneModel)


