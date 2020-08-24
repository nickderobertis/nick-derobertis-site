import param

from nick_derobertis_site.common.component import HTMLComponent
from .skills_pane_model import SkillsPaneModel


class SkillsPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=SkillsPaneModel)


