import param

from nick_derobertis_site.common.component import HTMLComponent
from .courses_banner_model import CoursesBannerModel


class CoursesBannerComponent(HTMLComponent):
    model = param.ClassSelector(class_=CoursesBannerModel)


