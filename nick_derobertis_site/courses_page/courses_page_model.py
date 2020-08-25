from typing import List

import param

from nick_derobertis_site.common.page_model import PageModel
from nick_derobertis_site.courses_page.course_pane.course_pane_component import CoursePaneComponent
from nick_derobertis_site.courses_page.course_pane.course_pane_model import CoursePaneModel
from nick_derobertis_site.courses_page.courses_banner.courses_banner_component import CoursesBannerComponent
from nick_derobertis_site.courses_page.courses_banner.courses_banner_model import CoursesBannerModel


class CoursesPageModel(PageModel):
    banner_model: CoursesBannerModel = param.ClassSelector(class_=CoursesBannerModel)
    banner: CoursesBannerComponent = param.ClassSelector(class_=CoursesBannerComponent)
    pane_models: List[CoursePaneModel] = param.List(class_=CoursePaneModel)
    panes: List[CoursePaneComponent] = param.List(class_=CoursePaneComponent)
    
    def __init__(self, **params):
        params['banner'] = CoursesBannerComponent(model=params['banner_model'])
        super().__init__(**params)
        self._set_panes()

    @param.depends('pane_models', watch=True)
    def _set_panes(self):
        all_panes = []
        for i, mod in enumerate(self.pane_models):
            kwargs = dict(model=mod)
            if i % 2 != 0:
                kwargs.update(is_reversed=True)
            all_panes.append(CoursePaneComponent(**kwargs))

        self.panes = all_panes