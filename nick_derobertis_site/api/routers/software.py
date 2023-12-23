from datetime import datetime
from typing import List, Optional, Sequence

from derobertis_cv.pldata.software import get_software_projects
from derobertis_cv.pldata.software.config import (
    EXCLUDED_SOFTWARE_PROJECTS,
    PROFESSIONAL_SOFTWARE_PROJECT_ORDER,
)
from derobertis_cv.pltemplates.software.project import SoftwareProject
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class APISoftwareModel(BaseModel):
    title: str
    description: str
    display_title: str
    created: Optional[datetime] = None
    updated: Optional[datetime] = None
    version: Optional[str] = None
    loc: Optional[int] = None
    commits: Optional[int] = None
    url: Optional[str] = None
    github_url: Optional[str] = None
    docs_url: Optional[str] = None
    logo_url: Optional[str] = None
    package_directory: Optional[str] = None
    logo_svg_text: Optional[str] = None
    logo_fa_icon_class_str: Optional[str] = None
    logo_base64: Optional[str] = None

    @classmethod
    def from_cv_model(cls, model: SoftwareProject) -> "APISoftwareModel":
        return cls(
            title=model.title,
            description=model.description,
            display_title=model.display_title,
            created=model.created,
            updated=model.updated,
            version=model.version,
            loc=model.loc,
            commits=model.commits,
            url=model.url,
            github_url=model.github_url,
            docs_url=model.docs_url,
            logo_url=model.logo_url,
            package_directory=model.package_directory,
            logo_svg_text=model.logo_svg_text,
            logo_fa_icon_class_str=model.logo_fa_icon_class_str,
            logo_base64=model.logo_base64,
        )

    @classmethod
    def list_from_cv_seq(
        cls, models: Sequence[SoftwareProject]
    ) -> List["APISoftwareModel"]:
        return [cls.from_cv_model(mod) for mod in models]


class APISoftwareStatisticsModel(BaseModel):
    count: int


ALL_PROJECT_CV_MODELS: List[SoftwareProject] = get_software_projects(
    exclude_projects=EXCLUDED_SOFTWARE_PROJECTS,
    order=PROFESSIONAL_SOFTWARE_PROJECT_ORDER,
)
ALL_PROJECT_MODELS = APISoftwareModel.list_from_cv_seq(ALL_PROJECT_CV_MODELS)
PROJECT_COUNT = len(ALL_PROJECT_MODELS)
PROJECT_STATS = APISoftwareStatisticsModel(count=PROJECT_COUNT)


@router.get("/", tags=["software"], response_model=List[APISoftwareModel])
async def read_parent_skills():
    return ALL_PROJECT_MODELS


@router.get("/stats", tags=["software"], response_model=APISoftwareStatisticsModel)
async def read_skill_stats():
    return PROJECT_STATS
