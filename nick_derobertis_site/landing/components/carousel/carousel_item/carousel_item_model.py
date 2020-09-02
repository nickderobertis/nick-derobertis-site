import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.image import HasImageModel
from nick_derobertis_site.general.widgets.button import ButtonModel


class CarouselItemModel(HasImageModel, ComponentModel):
    header_text = param.String()
    body_text = param.String()
    button_models = param.List(class_=ButtonModel)
    caption_div_classes = param.List(class_=str, default=['carousel-caption'])
    buttons_are_for_skills = param.Boolean(default=False)

    @property
    def caption_div_classes_str(self) -> str:
        return ' '.join(self.caption_div_classes)
