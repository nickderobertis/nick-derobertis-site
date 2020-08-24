from typing import List

from derobertis_cv.pldata.papers import get_working_papers, ResearchProjectModel, get_works_in_progress

from nick_derobertis_site.research_page.research_project_pane.research_project_pane_model import \
    ResearchProjectPaneModel

WORKING_PAPERS: List[ResearchProjectModel] = get_working_papers()
WORKS_IN_PROGRESS: List[ResearchProjectModel] = get_works_in_progress()

RESEARCH_PANE_MODELS = [
    ResearchProjectPaneModel.from_cv_project_model(paper) for paper in WORKING_PAPERS + WORKS_IN_PROGRESS
]

