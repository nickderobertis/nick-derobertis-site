import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.general.widgets.button import PrimaryRaisedButton
from .story_highlight_pane_model import StoryHighlightPaneModel


class StoryHighlightPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=StoryHighlightPaneModel)
    button: PrimaryRaisedButton = param.ClassSelector(class_=PrimaryRaisedButton)

    def __init__(self, **params):
        params['button'] = PrimaryRaisedButton(model=params['model'].button_model, services=params['services'])
        super().__init__(**params)


