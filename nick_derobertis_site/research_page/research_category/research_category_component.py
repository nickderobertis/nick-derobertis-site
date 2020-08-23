import param

from nick_derobertis_site.common.component import HTMLComponent
from .research_category_model import ResearchCategoryModel


class ResearchCategoryComponent(HTMLComponent):
    model = param.ClassSelector(class_=ResearchCategoryModel)


