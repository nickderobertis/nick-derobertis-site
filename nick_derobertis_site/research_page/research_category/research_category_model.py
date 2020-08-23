import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.image import HasImageModel


class ResearchCategoryModel(HasImageModel, ComponentModel):
    title: str = param.String(default='Category')