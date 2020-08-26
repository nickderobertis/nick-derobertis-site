import param

from nick_derobertis_site.common.component import HTMLComponent
from .award_model import AwardModel


class AwardComponent(HTMLComponent):
    model = param.ClassSelector(class_=AwardModel)


