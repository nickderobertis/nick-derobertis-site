import param

from nick_derobertis_site.common.component import HTMLComponent
from .loading_page_model import LoadingPageModel


class LoadingPageComponent(HTMLComponent):
    model = param.ClassSelector(class_=LoadingPageModel)


