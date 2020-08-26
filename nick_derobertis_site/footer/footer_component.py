import param

from nick_derobertis_site.common.component import HTMLComponent
from .footer_model import FooterModel


class FooterComponent(HTMLComponent):
    model = param.ClassSelector(class_=FooterModel)


