from typing import List, Optional, Sequence

from derobertis_cv.models.category import CategoryModel
from derobertis_cv.models.resources import ResourceModel
from derobertis_cv.pldata.papers import (
    ResearchProjectModel,
    get_working_papers,
    get_works_in_progress,
)
from derobertis_cv.pltemplates.coauthor import CoAuthor
from fastapi import APIRouter
from pydantic import BaseModel
from pydantic.fields import Field

router = APIRouter()


class APIResearchCategoryModel(BaseModel):
    title: str
    logo_svg_text: Optional[str] = None
    logo_fa_icon_class_str: Optional[str] = None

    @classmethod
    def from_cv_category_model(cls, model: CategoryModel) -> "APIResearchCategoryModel":
        return cls(
            title=model.title,
            logo_svg_text=model.logo_svg_text,
            logo_fa_icon_class_str=model.logo_fa_icon_class_str,
        )

    @classmethod
    def list_from_cv_seq(
        cls, models: Sequence[CategoryModel]
    ) -> List["APIResearchCategoryModel"]:
        return [cls.from_cv_category_model(mod) for mod in models]


class APICoAuthorModel(BaseModel):
    name: str

    @classmethod
    def from_cv_co_author_model(cls, model: CoAuthor) -> "APICoAuthorModel":
        return cls(name=model.author_name)

    @classmethod
    def list_from_cv_seq(cls, models: Sequence[CoAuthor]) -> List["APICoAuthorModel"]:
        return [cls.from_cv_co_author_model(mod) for mod in models]


class APIResourceModel(BaseModel):
    name: str
    url: str
    author: Optional[str] = None
    description: Optional[str] = None

    @classmethod
    def from_cv_model(cls, model: ResourceModel) -> "APIResourceModel":
        return cls(
            name=model.name,
            url=model.url,
            author=model.author,
            description=model.description,
        )

    @classmethod
    def list_from_cv_seq(
        cls, models: Sequence[ResourceModel]
    ) -> List["APIResourceModel"]:
        return [cls.from_cv_model(mod) for mod in models]


class APIResearchModel(BaseModel):
    title: str
    co_authors: List[APICoAuthorModel] = Field(default_factory=lambda: [])
    href: Optional[str] = None
    description: str = ""
    categories: Sequence[APIResearchCategoryModel] = Field(default_factory=lambda: [])
    resources: Sequence[APIResourceModel] = Field(default_factory=lambda: [])

    @classmethod
    def from_cv_research_model(cls, model: ResearchProjectModel) -> "APIResearchModel":
        return cls(
            title=model.title,
            co_authors=APICoAuthorModel.list_from_cv_seq(model.co_authors or []),
            href=model.href,
            description=model.description or "",
            categories=APIResearchCategoryModel.list_from_cv_seq(
                model.categories or []
            ),
            resources=APIResourceModel.list_from_cv_seq(model.resources or []),
        )

    @classmethod
    def list_from_cv_seq(
        cls, models: Sequence[ResearchProjectModel]
    ) -> List["APIResearchModel"]:
        return [cls.from_cv_research_model(mod) for mod in models]


class APIResearchResponseModel(BaseModel):
    working_papers: List[APIResearchModel] = Field(default_factory=lambda: [])
    works_in_progress: List[APIResearchModel] = Field(default_factory=lambda: [])


class APIResearchStatisticsModel(BaseModel):
    count: int


class APIResearchStatisticsResponseModel(BaseModel):
    working_papers: APIResearchStatisticsModel
    works_in_progress: APIResearchStatisticsModel


WORKING_PAPER_CV_MODELS: List[ResearchProjectModel] = get_working_papers()
WORKS_IN_PROGRESS_CV_MODELS: List[ResearchProjectModel] = get_works_in_progress()
WORKING_PAPERS = APIResearchModel.list_from_cv_seq(WORKING_PAPER_CV_MODELS)
WORKS_IN_PROGRESS = APIResearchModel.list_from_cv_seq(WORKS_IN_PROGRESS_CV_MODELS)
ALL_RESEARCH = APIResearchResponseModel(
    working_papers=WORKING_PAPERS, works_in_progress=WORKS_IN_PROGRESS
)
COUNT_WP = len(WORKING_PAPERS)
COUNT_WIP = len(WORKS_IN_PROGRESS)
STATS = APIResearchStatisticsResponseModel(
    working_papers=APIResearchStatisticsModel(count=COUNT_WP),
    works_in_progress=APIResearchStatisticsModel(count=COUNT_WIP),
)


@router.get("/", tags=["research"], response_model=APIResearchResponseModel)
async def read_all_research():
    return ALL_RESEARCH


@router.get("/working-papers", tags=["research"], response_model=List[APIResearchModel])
async def read_working_papers():
    return WORKING_PAPERS


@router.get(
    "/works-in-progress", tags=["research"], response_model=List[APIResearchModel]
)
async def read_works_in_progress():
    return WORKS_IN_PROGRESS


@router.get(
    "/stats",
    tags=["research"],
    response_model=APIResearchStatisticsResponseModel,
)
async def read_skill_stats():
    return STATS
