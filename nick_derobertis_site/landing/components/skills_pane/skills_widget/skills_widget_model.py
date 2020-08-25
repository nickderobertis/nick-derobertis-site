import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_dropdown.skills_widget_dropdown_component import \
    SkillsWidgetDropdownComponent
from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_dropdown.skills_widget_dropdown_model import \
    SkillsWidgetDropdownModel


class SkillsWidgetModel(ComponentModel):
    item_models = param.List(class_=SkillsWidgetDropdownModel)
    items = param.List(class_=SkillsWidgetDropdownComponent)

    def __init__(self, **params):
        params['items'] = [model.to_nested_component() for model in params['item_models']]
        super().__init__(**params)