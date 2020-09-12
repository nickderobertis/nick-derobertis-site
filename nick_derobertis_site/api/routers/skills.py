from typing import List, Sequence

from derobertis_cv.models.skill import SkillModel as CVSkillModel
from derobertis_cv.pldata.skills import get_skills
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SkillModel(BaseModel):
    title: str
    level: int

    @classmethod
    def from_cv_skill_model(cls, model: CVSkillModel):
        params = dict(title=model.to_title_case_str(), level=model.level,)

        return cls(**params)

    @classmethod
    def list_from_cv_skills(cls, models: Sequence[CVSkillModel]):
        return [cls.from_cv_skill_model(mod) for mod in models]


ALL_SKILL_CV_MODELS = get_skills()
PARENT_SKILL_CV_MODELS = [model for model in ALL_SKILL_CV_MODELS if not model.parents]
ALL_SKILL_MODELS = SkillModel.list_from_cv_skills(ALL_SKILL_CV_MODELS)
PARENT_SKILL_MODELS = SkillModel.list_from_cv_skills(PARENT_SKILL_CV_MODELS)


@router.get("/", tags=["skills"], response_model=List[SkillModel])
async def read_parent_skills():
    return PARENT_SKILL_MODELS


@router.get("/all", tags=["skills"], response_model=List[SkillModel])
async def read_all_skills():
    return ALL_SKILL_MODELS


@router.get("/children", tags=["skills"], response_model=List[SkillModel])
async def read_child_skills(title: str):
    for skill in ALL_SKILL_CV_MODELS:
        if skill.title == title:
            return SkillModel.list_from_cv_skills(skill.children)
    raise HTTPException(status_code=404, detail=f"Skill with title {title} not found")
