import datetime
from typing import Dict, List, Optional, Sequence, Union, cast

from derobertis_cv.models.skill import SkillModel as CVSkillModel
from derobertis_cv.pldata.cover_letters.models import (
    ApplicationFocus,
    SpecificApplicationFocus,
)
from derobertis_cv.pldata.skills import CV_SKILL_SECTION_ORDER, get_skills
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class APISkillModel(BaseModel):
    title: str
    level: int
    direct_parent_title: Optional[str]
    hours: Optional[float] = None
    first_used: Optional[datetime.date] = None
    experience_length_str: Optional[str] = None
    priorities: Dict[Union[SpecificApplicationFocus, ApplicationFocus], int] = Field(
        default_factory=lambda: {}
    )

    # TODO: maybe need a PR into pydantic2ts as it does not support enums as dictionary keys
    #
    # It currently casts them to strings and does not bring the enums through as ts types.
    # It should bring over the enum as a ts type and then have [k in EnumName] as the key
    # type, e.g. priorities?: {
    #     [k in ApplicationFocus]: number;
    #   }
    #
    # The current code is a hack to get the enums coming through
    unused_for_pydantic2ts: Optional[
        Union[SpecificApplicationFocus, ApplicationFocus]
    ] = None

    @classmethod
    def from_cv_skill_model(cls, model: CVSkillModel):
        params = dict(title=model.to_title_case_str(), level=model.level)

        # Uncomment to send priorities once they are to be used on the frontend. Disabled to reduce response size
        # params['priorities'] = model.priority.levels

        if not model.parents:
            params["direct_parent_title"] = None
        else:
            first_parent = cast(CVSkillModel, model.category)
            if first_parent == model:
                params["direct_parent_title"] = None
            elif (
                first_parent.to_lower_case_str() == "programming"
                and model.to_lower_case_str() == "frameworks"
            ):
                # TODO: come up with a better way of modifying skill parents
                #
                # Currently added an explicit condition to check for the frameworks skill and remove the parent,
                # but should have a more general system for this
                params["direct_parent_title"] = None
            else:
                params["direct_parent_title"] = first_parent.to_title_case_str()

        if model.experience is not None:
            params["hours"] = model.experience.hours
            params["first_used"] = model.experience.begin_date
            params["experience_length_str"] = model.experience.experience_length_str

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


EXCLUDE_SKILLS = ["research", "soft skills"]

ALL_SKILL_CV_MODELS = get_skills(
    exclude_skills=EXCLUDE_SKILLS, exclude_skill_children=False
)
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
    if skill.to_title_case_str() in CV_SKILL_SECTION_ORDER
    else 1000
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
PARENT_TO_CHILD_SKILL_MODELS = APISkillModel.list_from_cv_skills(
    PARENT_TO_CHILD_SKILL_CV_MODELS
)
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


@router.get("/stats", tags=["skills"], response_model=APISkillStatisticsModel)
async def read_skill_stats():
    mod = APISkillStatisticsModel(count=SKILL_COUNT, parent_count=PARENT_SKILL_COUNT)
    return mod
