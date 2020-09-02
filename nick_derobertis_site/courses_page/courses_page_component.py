from typing import List

import param

from nick_derobertis_site.common.component import HTMLComponent
from .course_pane.course_pane_component import CoursePaneComponent
from .courses_banner.courses_banner_component import CoursesBannerComponent
from .courses_page_model import CoursesPageModel


class CoursesPageComponent(HTMLComponent):
    model = param.ClassSelector(class_=CoursesPageModel)
    banner: CoursesBannerComponent = param.ClassSelector(class_=CoursesBannerComponent)
    panes: List[CoursePaneComponent] = param.List(class_=CoursePaneComponent)

    def __init__(self, **params):
        params["banner"] = CoursesBannerComponent(
            model=params["model"].banner_model, services=params["services"]
        )
        self._set_panes(params)
        super().__init__(**params)

    def _set_panes(self, params):
        all_panes = []
        for i, mod in enumerate(params["model"].pane_models):
            kwargs = dict(model=mod, services=params["services"])
            if i % 2 != 0:
                kwargs.update(is_reversed=True)
            all_panes.append(CoursePaneComponent(**kwargs))

        params["panes"] = all_panes
