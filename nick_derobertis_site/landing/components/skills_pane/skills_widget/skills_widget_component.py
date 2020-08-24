import param

from nick_derobertis_site.common.component import HTMLComponent
from .skills_widget_model import SkillsWidgetModel


class SkillsWidgetComponent(HTMLComponent):
    model = param.ClassSelector(class_=SkillsWidgetModel)


