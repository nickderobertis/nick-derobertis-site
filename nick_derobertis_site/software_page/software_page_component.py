import param

from nick_derobertis_site.common.component import HTMLComponent
from .software_page_model import SoftwarePageModel


class SoftwarePageComponent(HTMLComponent):
    model = param.ClassSelector(class_=SoftwarePageModel)


