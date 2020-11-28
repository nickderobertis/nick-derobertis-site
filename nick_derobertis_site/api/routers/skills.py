from typing import List, Sequence, Optional, cast

from derobertis_cv.models.skill import SkillModel as CVSkillModel
from derobertis_cv.pldata.skills import get_skills, CV_EXCLUDE_SKILLS, CV_SKILL_SECTION_ORDER
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class APISkillModel(BaseModel):
    title: str
    level: int
    direct_parent_title: Optional[str]

    @classmethod
    def from_cv_skill_model(cls, model: CVSkillModel):
        params = dict(title=model.to_title_case_str(), level=model.level)
        if not model.parents:
            params['direct_parent_title'] = None
        else:
            first_parent = cast(CVSkillModel, model.category)
            if first_parent == model:
                params['direct_parent_title'] = None
            else:
                params['direct_parent_title'] = first_parent.to_title_case_str()

        return cls(**params)

    @classmethod
    def list_from_cv_skills(cls, models: Sequence[CVSkillModel]):
        unique_mods: List[CVSkillModel] = []
        for mod in models:
            if mod not in unique_mods:
                unique_mods.append(mod)

        return [cls.from_cv_skill_model(mod) for mod in unique_mods]


class APISkillStatisticsModel(BaseModel):
    count: int
    parent_count: int


def get_recursive_child_skills(mod: CVSkillModel) -> List[CVSkillModel]:
    models: List[CVSkillModel] = []
    models.extend(mod.children)
    for child in mod.children:
        models.extend(get_recursive_child_skills(child))
    return models


EXCLUDE_SKILLS = CV_EXCLUDE_SKILLS + ['soft skills']

ALL_SKILL_CV_MODELS = get_skills(exclude_skills=EXCLUDE_SKILLS, exclude_skill_children=False)
PARENT_SKILL_CV_MODELS = []
for model in ALL_SKILL_CV_MODELS:
    parent = model.category
    if parent.to_lower_case_str() in EXCLUDE_SKILLS:
        continue
    if parent not in PARENT_SKILL_CV_MODELS:
        PARENT_SKILL_CV_MODELS.append(parent)
    if parent not in ALL_SKILL_CV_MODELS:
        ALL_SKILL_CV_MODELS.append(parent)
ALL_SKILL_CV_MODELS.sort(key=lambda skill: skill.level, reverse=True)

orig_category_names = CV_SKILL_SECTION_ORDER.copy()
PARENT_SKILL_CV_MODELS.sort(
    key=lambda skill: CV_SKILL_SECTION_ORDER.index(skill.to_title_case_str())
    if skill.to_title_case_str() in CV_SKILL_SECTION_ORDER else 1000
)

PARENT_TO_CHILD_SKILL_CV_MODELS: List[CVSkillModel] = PARENT_SKILL_CV_MODELS.copy()
for mod in PARENT_SKILL_CV_MODELS:
    for child in get_recursive_child_skills(mod):
        if child in PARENT_TO_CHILD_SKILL_CV_MODELS:
            continue
        if child.category not in PARENT_SKILL_CV_MODELS:
            continue
        PARENT_TO_CHILD_SKILL_CV_MODELS.append(child)

ALL_SKILL_MODELS = APISkillModel.list_from_cv_skills(ALL_SKILL_CV_MODELS)
PARENT_SKILL_MODELS = APISkillModel.list_from_cv_skills(PARENT_SKILL_CV_MODELS)
PARENT_TO_CHILD_SKILL_MODELS = APISkillModel.list_from_cv_skills(PARENT_TO_CHILD_SKILL_CV_MODELS)
SKILL_COUNT = len(ALL_SKILL_MODELS)
PARENT_SKILL_COUNT = len(PARENT_SKILL_MODELS)


@router.get("/", tags=["skills"], response_model=List[APISkillModel])
async def read_parent_skills():
    return PARENT_SKILL_MODELS


@router.get("/all", tags=["skills"], response_model=List[APISkillModel])
async def read_all_skills():
    return PARENT_TO_CHILD_SKILL_MODELS


@router.get("/children", tags=["skills"], response_model=List[APISkillModel])
async def read_child_skills(title: str):
    for skill in ALL_SKILL_CV_MODELS:
        if skill.to_title_case_str() == title:
            children = list(skill.children)
            children.sort(key=lambda skill: skill.level, reverse=True)
            return APISkillModel.list_from_cv_skills(children)
    raise HTTPException(status_code=404, detail=f"Skill with title {title} not found")


@router.get('/stats', tags=['skills'], response_model=APISkillStatisticsModel)
async def read_skill_stats():
    mod = APISkillStatisticsModel(count=SKILL_COUNT, parent_count=PARENT_SKILL_COUNT)
    return mod