from typing import List

import param

from nick_derobertis_site.common.page_model import PageModel
from nick_derobertis_site.courses_page.course_pane.course_pane_model import CoursePaneModel
from nick_derobertis_site.courses_page.courses_banner.courses_banner_model import CoursesBannerModel


class CoursesPageModel(PageModel):
    banner_model: CoursesBannerModel = param.ClassSelector(class_=CoursesBannerModel)
    pane_models: List[CoursePaneModel] = param.List(class_=CoursePaneModel)
