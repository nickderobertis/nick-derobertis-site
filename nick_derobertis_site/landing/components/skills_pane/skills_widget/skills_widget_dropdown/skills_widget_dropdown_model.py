from typing import List, TYPE_CHECKING
if TYPE_CHECKING:
    from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_dropdown.skills_widget_dropdown_component import \
        SkillsWidgetDropdownComponent

import param

from nick_derobertis_site.common.model import ComponentModel
from derobertis_cv.models.skill import SkillModel




class SkillsWidgetDropdownModel(ComponentModel):
    title: str = param.String()
    level: int = param.Integer()
    items: List['SkillsWidgetDropdownModel'] = param.List()
    is_child: bool = param.Boolean(default=False)

    @classmethod
    def from_skill_model(cls, model: SkillModel, is_child: bool = False):
        child_models = [SkillsWidgetDropdownModel.from_skill_model(child, is_child=True) for child in model.children]

        params = dict(
            title=model.to_title_case_str(),
            level=model.level,
            items=child_models,
            is_child=is_child
        )

        return cls(**params)

    def to_nested_component(self) -> 'SkillsWidgetDropdownComponent':
        from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_dropdown.skills_widget_dropdown_component import \
            SkillsWidgetDropdownComponent

        child_comps = [child.to_nested_component() for child in self.items]
        comp = SkillsWidgetDropdownComponent(model=self, items=child_comps)
        return comp
