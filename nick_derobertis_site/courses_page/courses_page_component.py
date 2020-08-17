import param

from nick_derobertis_site.common.component import HTMLComponent
from .courses_page_model import CoursesPageModel


class CoursesPageComponent(HTMLComponent):
    model = param.ClassSelector(class_=CoursesPageModel)


