import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.image import HasImageModel
from nick_derobertis_site.general.widgets.button import PageButtonBase


class StoryHighlightPaneModel(HasImageModel, ComponentModel):
    button: PageButtonBase = param.ClassSelector(class_=PageButtonBase)