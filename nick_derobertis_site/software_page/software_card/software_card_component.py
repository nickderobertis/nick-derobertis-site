import param

from nick_derobertis_site.common.component import HTMLComponent
from .software_card_model import SoftwareCardModel


class SoftwareCardComponent(HTMLComponent):
    model = param.ClassSelector(class_=SoftwareCardModel)


