from typing import List, Optional, Sequence

from derobertis_cv.models.award import AwardModel
from derobertis_cv.pldata.awards import get_awards
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class APIAwardModel(BaseModel):
    title: str
    logo_svg_text: Optional[str] = None
    logo_fa_icon_class_str: Optional[str] = None
    received: Optional[str] = None
    extra_info: Optional[str] = None
    award_parts: Optional[Sequence[str]] = None

    @classmethod
    def from_cv_award_model(cls, model: AwardModel) -> "APIAwardModel":
        kwargs = dict(
            title=model.title,
            logo_svg_text=model.logo_svg_text,
            logo_fa_icon_class_str=model.logo_fa_icon_class_str,
            received=model.received,
            extra_info=model.extra_info,
            award_parts=model.award_parts,
        )

        return cls(**kwargs)

    @classmethod
    def list_from_cv_awards(cls, models: Sequence[AwardModel]) -> List["APIAwardModel"]:
        return [cls.from_cv_award_model(mod) for mod in models]


class APIAwardStatisticsModel(BaseModel):
    count: int


SELECT_AWARD_NAMES = [
    "Warrington College of Business Ph.D. Student Teaching Award",
    "CFA Global Investment Research Challenge – Global Semi-Finalist",
    "Graduate Management Admission Test (GMAT) Score",
    "Finance Student of the Year",
]

ALL_AWARD_CV_MODELS = get_awards()
SELECTED_AWARD_CV_MODELS = get_awards(
    include_awards=SELECT_AWARD_NAMES, order=SELECT_AWARD_NAMES
)
ALL_SKILL_MODELS = APIAwardModel.list_from_cv_awards(ALL_AWARD_CV_MODELS)
SELECTED_SKILL_MODELS = APIAwardModel.list_from_cv_awards(SELECTED_AWARD_CV_MODELS)
AWARD_COUNT = len(ALL_SKILL_MODELS)


@router.get("/", tags=["awards"], response_model=List[APIAwardModel])
async def read_all_awards():
    return ALL_SKILL_MODELS


@router.get("/selected", tags=["awards"], response_model=List[APIAwardModel])
async def read_selected_awards():
    return SELECTED_SKILL_MODELS


@router.get("/stats", tags=["awards"], response_model=APIAwardStatisticsModel)
async def read_skill_stats():
    mod = APIAwardStatisticsModel(count=AWARD_COUNT)
    return mod
