from typing import List

import param
from derobertis_cv.models.award import AwardModel as CVAwardModel

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.image import HasImageModel
from nick_derobertis_site.general.models.image import ImageModel


class AwardModel(HasImageModel, ComponentModel):
    description_lines: List[str] = param.List(class_=str)
    received: str = param.String()
    logo_fa_class_str: str = param.String(default='fas fa-graduation-cap')
    logo_svg_text: str = param.String()

    @classmethod
    def from_cv_model(cls, model: CVAwardModel, image_model: ImageModel):
        params = dict(
            received=model.received,
            logo_svg_text=model.logo_svg_text or '',
            logo_fa_class_str=model.logo_fa_icon_class_str or 'fas fa-graduation-cap',
            description_lines=model.award_parts or [],
            image=image_model,
        )

        return cls(**params)