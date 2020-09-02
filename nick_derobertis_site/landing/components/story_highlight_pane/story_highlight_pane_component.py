import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.general.widgets.button import PrimaryButton
from .story_highlight_pane_model import StoryHighlightPaneModel


class StoryHighlightPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=StoryHighlightPaneModel)
    button: PrimaryButton = param.ClassSelector(class_=PrimaryButton)

    def __init__(self, **params):
        params['button'] = PrimaryButton(model=params['model'].button_model)
        super().__init__(**params)


