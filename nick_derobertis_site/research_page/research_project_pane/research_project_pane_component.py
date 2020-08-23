import param

from nick_derobertis_site.common.component import HTMLComponent
from .research_project_pane_model import ResearchProjectPaneModel


class ResearchProjectPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=ResearchProjectPaneModel)
    is_reversed: bool = param.Boolean(default=False)



