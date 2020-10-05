from typing import List, Sequence

from derobertis_cv.models.skill import SkillModel as CVSkillModel
from derobertis_cv.pldata.skills import get_skills
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class APISkillModel(BaseModel):
    title: str
    level: int

    @classmethod
    def from_cv_skill_model(cls, model: CVSkillModel):
        params = dict(title=model.to_title_case_str(), level=model.level,)

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


ALL_SKILL_CV_MODELS = get_skills()
PARENT_SKILL_CV_MODELS = []
for model in ALL_SKILL_CV_MODELS:
    parent = model.category
    if parent not in PARENT_SKILL_CV_MODELS:
        PARENT_SKILL_CV_MODELS.append(parent)
    if parent not in ALL_SKILL_CV_MODELS:
        ALL_SKILL_CV_MODELS.append(parent)
ALL_SKILL_MODELS = APISkillModel.list_from_cv_skills(ALL_SKILL_CV_MODELS)
PARENT_SKILL_MODELS = APISkillModel.list_from_cv_skills(PARENT_SKILL_CV_MODELS)
SKILL_COUNT = len(ALL_SKILL_MODELS)
PARENT_SKILL_COUNT = len(PARENT_SKILL_MODELS)


@router.get("/", tags=["skills"], response_model=List[APISkillModel])
async def read_parent_skills():
    return PARENT_SKILL_MODELS


@router.get("/all", tags=["skills"], response_model=List[APISkillModel])
async def read_all_skills():
    return ALL_SKILL_MODELS


@router.get("/children", tags=["skills"], response_model=List[APISkillModel])
async def read_child_skills(title: str):
    for skill in ALL_SKILL_CV_MODELS:
        if skill.to_title_case_str() == title:
            return APISkillModel.list_from_cv_skills(skill.children)
    raise HTTPException(status_code=404, detail=f"Skill with title {title} not found")


@router.get('/stats', tags=['skills'], response_model=APISkillStatisticsModel)
async def read_skill_stats():
    mod = APISkillStatisticsModel(count=SKILL_COUNT, parent_count=PARENT_SKILL_COUNT)
    return mod