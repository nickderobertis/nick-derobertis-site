import param

from nick_derobertis_site.common.component import HTMLComponent
from .course_pane_model import CoursePaneModel


class CoursePaneComponent(HTMLComponent):
    model = param.ClassSelector(class_=CoursePaneModel)
    is_reversed: bool = param.Boolean(default=False)


