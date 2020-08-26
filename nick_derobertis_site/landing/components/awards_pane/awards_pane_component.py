import param

from nick_derobertis_site.common.component import HTMLComponent
from .awards_pane_model import AwardsPaneModel


class AwardsPaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=AwardsPaneModel)


