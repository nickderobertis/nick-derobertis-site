import param

from nick_derobertis_site.common.component import HTMLComponent
from nick_derobertis_site.landing.page.landing_page_model import LandingPageModel


class LandingPageComponent(HTMLComponent):
    model = param.ClassSelector(class_=LandingPageModel)
