import param

from nick_derobertis_site.common.page_model import PageModel
from nick_derobertis_site.courses_page.courses_banner.courses_banner_component import CoursesBannerComponent
from nick_derobertis_site.courses_page.courses_banner.courses_banner_model import CoursesBannerModel


class CoursesPageModel(PageModel):
    banner_model: CoursesBannerModel = param.ClassSelector(class_=CoursesBannerModel)
    banner: CoursesBannerComponent = param.ClassSelector(class_=CoursesBannerComponent)
    
    def __init__(self, **params):
        params['banner'] = CoursesBannerComponent(model=params['banner_model'])
        super().__init__(**params)
