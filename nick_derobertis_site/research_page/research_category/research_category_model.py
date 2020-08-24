import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.image import HasImageModel
from derobertis_cv.category import CategoryModel


class ResearchCategoryModel(HasImageModel, ComponentModel):
    title: str = param.String(default='Category')
    image_src: str = param.String(default='')
    fa_logo_class_str: str = param.String()
    image_svg_text: str = param.String()

    @classmethod
    def from_cv_category_model(cls, model: CategoryModel):
        params = dict(
            title=model.title,
            image_src=model.logo_base64 or '',
            fa_logo_class_str=model.logo_fa_icon_class_str or '',
            image_svg_text=model.logo_svg_text or '',
        )
        return cls(**params)
