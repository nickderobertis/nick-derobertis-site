from typing import List

from derobertis_cv.pldata.software import get_software_projects
from derobertis_cv.pldata.software.config import EXCLUDED_SOFTWARE_PROJECTS, PROFESSIONAL_SOFTWARE_PROJECT_ORDER
from derobertis_cv.pltemplates.software.project import SoftwareProject

from nick_derobertis_site.software_page.software_card.software_card_model import SoftwareCardModel

project_models: List[SoftwareProject] = get_software_projects(
    exclude_projects=EXCLUDED_SOFTWARE_PROJECTS,
    order=PROFESSIONAL_SOFTWARE_PROJECT_ORDER,
)

SOFTWARE_CARD_MODELS: List[SoftwareCardModel] = [
    SoftwareCardModel.from_software_project(project) for project in project_models
]
