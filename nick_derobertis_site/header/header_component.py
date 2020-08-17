import param

from nick_derobertis_site.common.component import HTMLComponent
from .header_model import HeaderModel
from ..common.providers import HasPageService


class HeaderComponent(HasPageService, HTMLComponent):
    model = param.ClassSelector(class_=HeaderModel)


