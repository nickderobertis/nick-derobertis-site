import param

from nick_derobertis_site.common.component import HTMLComponent
from .research_banner_model import ResearchBannerModel


class ResearchBannerComponent(HTMLComponent):
    model = param.ClassSelector(class_=ResearchBannerModel)


