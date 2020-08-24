import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_component import \
    SkillsWidgetComponent
from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_model import SkillsWidgetModel


class SkillsPaneModel(ComponentModel):
    widget_model = param.ClassSelector(class_=SkillsWidgetModel)
    widget = param.ClassSelector(class_=SkillsWidgetComponent)

    def __init__(self, **params):
        params['widget'] = SkillsWidgetComponent(model=params['widget_model'])
        super().__init__(**params)
