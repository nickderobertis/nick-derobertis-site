from typing import List

import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.general.widgets.button import ButtonModel


class ContactPaneModel(ComponentModel):
    email: str = param.String()
    button_models: List[ButtonModel] = param.List(class_=ButtonModel)