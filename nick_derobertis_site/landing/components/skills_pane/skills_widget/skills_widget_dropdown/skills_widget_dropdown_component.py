from typing import List

import param

from nick_derobertis_site.common.component import HTMLComponent
from .skills_widget_dropdown_model import SkillsWidgetDropdownModel


class SkillsWidgetDropdownComponent(HTMLComponent):
    model = param.ClassSelector(class_=SkillsWidgetDropdownModel)
    items: List['SkillsWidgetDropdownComponent'] = param.List()


