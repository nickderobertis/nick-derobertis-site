import param

from nick_derobertis_site.common.model import ComponentModel
from nick_derobertis_site.common.providers.image import HasImageModel


class SoftwareBannerModel(HasImageModel, ComponentModel):
    header_text: str = param.String()
    sub_text: str = param.String()

