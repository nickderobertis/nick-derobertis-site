import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.general.widgets.button import ButtonBase

PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAHd3dwAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='


class CarouselItemModel(ComponentModel):
    header_text = param.String()
    body_text = param.String()
    buttons = param.List(class_=ButtonBase)
    image_src = param.String(default=PLACEHOLDER_IMAGE)
    image = param.ClassSelector(class_=ImageModel)
    caption_div_classes = param.List(class_=str, default=['carousel-caption'])

    def __init__(self, **params):
        if 'image_src' not in params and 'image' in params:
            params['image_src'] = params['image'].src
        super().__init__(**params)

    @property
    def caption_div_classes_str(self) -> str:
        return ' '.join(self.caption_div_classes)
