import param

from nick_derobertis_site.common.component import HTMLComponent
from .software_banner_model import SoftwareBannerModel


class SoftwareBannerComponent(HTMLComponent):
    model = param.ClassSelector(class_=SoftwareBannerModel)


