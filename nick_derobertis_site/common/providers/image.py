import param

from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.general.utils import PLACEHOLDER_IMAGE


class HasImageModel:
    image: ImageModel = param.ClassSelector(class_=ImageModel)
    image_src: str = param.String(default=PLACEHOLDER_IMAGE)

    def __init__(self, **params):
        if 'image_src' not in params and 'image' in params:
            params['image_src'] = params['image'].src
        super().__init__(**params)