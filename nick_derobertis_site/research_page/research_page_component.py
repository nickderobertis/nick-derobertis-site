import param

from nick_derobertis_site.common.component import HTMLComponent
from .research_page_model import ResearchPageModel


class ResearchPageComponent(HTMLComponent):
    model = param.ClassSelector(class_=ResearchPageModel)


