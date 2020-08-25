from derobertis_cv.pldata.skills import get_skills

from nick_derobertis_site.landing.components.skills_pane.skills_pane_model import SkillsPaneModel
from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_dropdown.skills_widget_dropdown_model import \
    SkillsWidgetDropdownModel
from nick_derobertis_site.landing.components.skills_pane.skills_widget.skills_widget_model import SkillsWidgetModel

ALL_SKILL_MODELS = get_skills()
PARENT_SKILL_MODELS = [model for model in ALL_SKILL_MODELS if not model.parents]

SKILL_DROPDOWN_MODELS = [SkillsWidgetDropdownModel.from_skill_model(model) for model in PARENT_SKILL_MODELS]

SKILLS_WIDGET_MODEL = SkillsWidgetModel(item_models=SKILL_DROPDOWN_MODELS)

SKILLS_PANE_MODEL = SkillsPaneModel(widget_model=SKILLS_WIDGET_MODEL, num_skills=len(ALL_SKILL_MODELS))
