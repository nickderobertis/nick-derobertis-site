import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.image import HasImageModel
from nick_derobertis_site.general.widgets.button import PageButtonBase, ButtonModel


class StoryHighlightPaneModel(HasImageModel, ComponentModel):
    button_model: ButtonModel = param.ClassSelector(class_=ButtonModel)