from typing import List

import param
from derobertis_cv.pldata.papers import ResearchProjectModel

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.general.utils import and_join
from nick_derobertis_site.research_page.research_category.research_category_component import ResearchCategoryComponent
from nick_derobertis_site.research_page.research_category.research_category_model import ResearchCategoryModel


class ResearchProjectPaneModel(ComponentModel):
    title: str = param.String(default='My Research Project')
    description: str = param.String(default='Placeholder description')
    co_authors_str: str = param.String()
    category_models: List[ResearchCategoryModel] = param.List(class_=ResearchCategoryModel)
    categories: List[ResearchCategoryComponent] = param.List(class_=ResearchCategoryComponent)

    def __init__(self, **params):
        super().__init__(**params)
        self._set_categories()

    @param.depends('category_models', watch=True)
    def _set_categories(self):
        self.categories = [ResearchCategoryComponent(model=mod) for mod in self.category_models]

    @classmethod
    def from_cv_project_model(cls, model: ResearchProjectModel) -> 'ResearchProjectPaneModel':
        category_models = [ResearchCategoryModel.from_cv_category_model(cat) for cat in model.categories]

        if model.co_authors is not None:
            co_authors_str = and_join([author.author_name for author in model.co_authors])
        else:
            co_authors_str = ''

        params = dict(
            title=model.title,
            description=model.description,
            category_models=category_models,
            co_authors_str=co_authors_str
        )

        return cls(**params)
