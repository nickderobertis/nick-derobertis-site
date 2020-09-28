import datetime
from enum import Enum
from typing import List, Sequence, Optional, Union

from derobertis_cv.pldata.education import get_education
from derobertis_cv.pldata.education_model import EducationModel
from derobertis_cv.pldata.employment_model import (
    EmploymentModel,
    AcademicEmploymentModel,
)
from derobertis_cv.pldata.jobs import get_professional_jobs, get_academic_jobs
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class TimelineTypes(str, Enum):
    PROFESSIONAL_EMPLOYMENT = "professional employment"
    ACADEMIC_EMPLOYMENT = "academic employment"
    EDUCATION = "education"


class APITimelineModel(BaseModel):
    organization: str
    role: str
    location: str
    item_type: TimelineTypes
    begin_date: datetime.date
    end_date: Optional[datetime.date] = None
    description: Optional[Sequence[str]] = None

    @classmethod
    def from_cv_employment(cls, model: EmploymentModel) -> "APITimelineModel":
        if isinstance(model, AcademicEmploymentModel):
            item_type = TimelineTypes.ACADEMIC_EMPLOYMENT
        else:
            item_type = TimelineTypes.PROFESSIONAL_EMPLOYMENT

        return cls(
            organization=model.company_name,
            role=model.job_title,
            location=model.location,
            item_type=item_type,
            begin_date=model.begin_date,
            end_date=model.end_date,
            description=model.contents,
        )

    @classmethod
    def from_cv_education(cls, model: EducationModel) -> "APITimelineModel":
        return cls(
            organization=model.institution.title,
            role=model.degree_name,
            location=model.institution.location,
            item_type=TimelineTypes.EDUCATION,
            begin_date=model.begin_date,
            end_date=model.end_date,
        )

    @classmethod
    def list_from_cv_seq(
        cls, models: Sequence[Union[EmploymentModel, EducationModel]]
    ) -> List["APITimelineModel"]:
        api_models = []
        for mod in models:
            if isinstance(mod, EducationModel):
                api_models.append(cls.from_cv_education(mod))
            elif isinstance(mod, EmploymentModel):
                api_models.append(cls.from_cv_employment(mod))
            else:
                raise ValueError(
                    f"must pass models of type EducationModel or EmploymentModel, "
                    f"got {mod} of type {type(mod)}"
                )

        return api_models


class APITimelineResponseModel(BaseModel):
    items: List[APITimelineModel]


class APITimelineStatisticsModel(BaseModel):
    count: int
    begin_date: datetime.date
    end_date: Optional[datetime.date] = None

    @classmethod
    def from_api_timeline_models(cls, models: Sequence[APITimelineModel]):
        count = len(models)
        begin_date = min([mod.begin_date for mod in models])
        end_dates = [mod.end_date for mod in models]
        if any([end_date is None for end_date in end_dates]):
            end_date = None
        else:
            end_date = max([mod.begin_date for mod in models])
        return cls(
            count=count,
            begin_date=begin_date,
            end_date=end_date,
        )


class APITimelineStatisticsResponseModel(BaseModel):
    education: APITimelineStatisticsModel
    professional: APITimelineStatisticsModel
    academic: APITimelineStatisticsModel
    overall: APITimelineStatisticsModel


EDUCATION_CV_MODELS: List[EducationModel] = get_education()
PROFESSIONAL_EMPLOYMENT_CV_MODELS: List[EmploymentModel] = get_professional_jobs()
ACADEMIC_EMPLOYMENT_CV_MODELS: List[AcademicEmploymentModel] = get_academic_jobs()
ALL_CV_MODELS = (
    EDUCATION_CV_MODELS
    + PROFESSIONAL_EMPLOYMENT_CV_MODELS
    + ACADEMIC_EMPLOYMENT_CV_MODELS
)
EDUCATION_TIMELINE_MODELS: List[APITimelineModel] = APITimelineModel.list_from_cv_seq(
    EDUCATION_CV_MODELS
)
PROFESSIONAL_TIMELINE_MODELS: List[
    APITimelineModel
] = APITimelineModel.list_from_cv_seq(PROFESSIONAL_EMPLOYMENT_CV_MODELS)
ACADEMIC_TIMELINE_MODELS: List[APITimelineModel] = APITimelineModel.list_from_cv_seq(
    ACADEMIC_EMPLOYMENT_CV_MODELS
)
ALL_TIMELINE_MODELS = (
    EDUCATION_TIMELINE_MODELS + PROFESSIONAL_TIMELINE_MODELS + ACADEMIC_TIMELINE_MODELS
)
ALL_RESPONSE_MODEL = APITimelineResponseModel(items=ALL_TIMELINE_MODELS)
STATS = APITimelineStatisticsResponseModel(
    education=APITimelineStatisticsModel.from_api_timeline_models(
        EDUCATION_TIMELINE_MODELS
    ),
    professional=APITimelineStatisticsModel.from_api_timeline_models(
        PROFESSIONAL_TIMELINE_MODELS
    ),
    academic=APITimelineStatisticsModel.from_api_timeline_models(
        ACADEMIC_TIMELINE_MODELS
    ),
    overall=APITimelineStatisticsModel.from_api_timeline_models(ALL_TIMELINE_MODELS),
)


@router.get("/", tags=["timeline"], response_model=APITimelineResponseModel)
async def read_all_research():
    return ALL_RESPONSE_MODEL


@router.get(
    "/stats",
    tags=["timeline"],
    response_model=APITimelineStatisticsResponseModel,
)
async def read_skill_stats():
    return STATS
