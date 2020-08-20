import param

from nick_derobertis_site.common.model import ComponentModel


class SoftwareBannerModel(ComponentModel):
    header_text: str = param.String()
    sub_text: str = param.String()
