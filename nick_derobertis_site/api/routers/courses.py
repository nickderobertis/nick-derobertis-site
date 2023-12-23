from typing import List, Optional, Sequence

from derobertis_cv.models.category import CategoryModel
from derobertis_cv.models.course import CourseModel
from derobertis_cv.models.university import UniversityModel
from derobertis_cv.pldata.courses.main import get_courses
from fastapi import APIRouter
from pydantic import BaseModel

from nick_derobertis_site.api.routers.software import APISoftwareModel

router = APIRouter()


class APIUniversityModel(BaseModel):
    title: str
    abbreviation: str
    logo_url: Optional[str] = None
    logo_svg_text: Optional[str] = None
    logo_fa_icon_class_str: Optional[str] = None
    logo_base64: Optional[str] = None

    @classmethod
    def from_cv_model(cls, model: UniversityModel) -> "APIUniversityModel":
        return cls(
            title=model.title,
            abbreviation=model.abbreviation,
            logo_url=model.logo_url,
            logo_svg_text=model.logo_svg_text,
            logo_fa_icon_class_str=model.logo_fa_icon_class_str,
            logo_base64=model.logo_base64,
        )


class APICourseTopicModel(BaseModel):
    title: str
    logo_svg_text: Optional[str] = None
    logo_fa_icon_class_str: Optional[str] = None
    children: Optional[Sequence["APICourseTopicModel"]] = None

    @classmethod
    def from_cv_category_model(cls, model: CategoryModel) -> "APICourseTopicModel":
        return cls(
            title=model.title,
            logo_svg_text=model.logo_svg_text,
            logo_fa_icon_class_str=model.logo_fa_icon_class_str,
            children=cls.list_from_cv_seq(model.children),
        )

    @classmethod
    def list_from_cv_seq(
        cls, models: Sequence[CategoryModel]
    ) -> List["APICourseTopicModel"]:
        return [cls.from_cv_category_model(mod) for mod in models]


APICourseTopicModel.update_forward_refs()


class APICourseModel(BaseModel):
    title: str
    description: str
    periods_taught: Optional[Sequence[str]] = None
    evaluation_score: Optional[float] = None
    evaluation_max_score: int = 5
    university: Optional[APIUniversityModel] = None
    course_id: Optional[str] = None
    instructor: str = "Nick DeRobertis"
    instructor_email: Optional[str] = "derobertisna@ufl.edu"
    topics: Optional[Sequence[APICourseTopicModel]] = None
    current_period: Optional[str] = None
    current_time: Optional[str] = None
    website_url: Optional[str] = None
    software_projects: Optional[Sequence[APISoftwareModel]] = None
    pdf_name: Optional[str] = None

    @classmethod
    def from_cv_model(cls, model: CourseModel) -> "APICourseModel":
        return cls(
            title=model.title,
            description=model.description,
            periods_taught=model.periods_taught,
            evaluation_score=model.evaluation_score,
            evaluation_max_score=model.evaluation_max_score,
            university=APIUniversityModel.from_cv_model(model.university),
            course_id=model.course_id,
            instructor=model.instructor,
            instructor_email=model.instructor_email,
            topics=APICourseTopicModel.list_from_cv_seq(model.topics),
            current_period=model.current_period,
            current_time=model.current_time,
            website_url=model.website_url,
            software_projects=APISoftwareModel.list_from_cv_seq(
                model.software_projects or []
            ),
        )

    @classmethod
    def list_from_cv_seq(cls, models: Sequence[CourseModel]) -> List["APICourseModel"]:
        return [cls.from_cv_model(mod) for mod in models]


class APICourseStatisticsModel(BaseModel):
    count: int


ALL_COURSE_CV_MODELS = get_courses()
ALL_COURSE_MODELS = APICourseModel.list_from_cv_seq(ALL_COURSE_CV_MODELS)

for cp in ALL_COURSE_MODELS:
    if cp.title == "Financial Modeling":
        cp.pdf_name = "Financial Modeling Syllabus.pdf"


COURSE_COUNT = len(ALL_COURSE_MODELS)
COURSE_STATS = APICourseStatisticsModel(count=COURSE_COUNT)


@router.get("/", tags=["courses"], response_model=List[APICourseModel])
async def read_parent_skills():
    return ALL_COURSE_MODELS


@router.get("/stats", tags=["courses"], response_model=APICourseStatisticsModel)
async def read_skill_stats():
    return COURSE_STATS
