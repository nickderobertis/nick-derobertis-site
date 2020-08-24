from typing import List

import param

from nick_derobertis_site.common.model import ComponentModel
from derobertis_cv.models.skill import SkillModel

class SkillsWidgetDropdownModel(ComponentModel):
    title: str = param.String()
    level: int = param.Integer()
    items: List['SkillsWidgetDropdownModel'] = param.List()

    @classmethod
    def from_skill_model(cls, model: SkillModel):
        child_models = [SkillsWidgetDropdownModel.from_skill_model(child) for child in model.children]

        params = dict(
            title=model.title,
            level=model.level,
            items=child_models,
        )

        return cls(**params)


