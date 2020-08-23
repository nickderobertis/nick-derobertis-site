from typing import List

import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.research_page.research_category.research_category_component import ResearchCategoryComponent
from nick_derobertis_site.research_page.research_category.research_category_model import ResearchCategoryModel


class ResearchProjectPaneModel(ComponentModel):
    title: str = param.String(default='My Research Project')
    description: str = param.String(default='Placeholder description')
    category_models: List[ResearchCategoryModel] = param.List(class_=ResearchCategoryModel)
    categories: List[ResearchCategoryComponent] = param.List(class_=ResearchCategoryComponent)

    def __init__(self, **params):
        super().__init__(**params)
        self._set_categories()

    @param.depends('category_models', watch=True)
    def _set_categories(self):
        self.categories = [ResearchCategoryComponent(model=mod) for mod in self.category_models]
