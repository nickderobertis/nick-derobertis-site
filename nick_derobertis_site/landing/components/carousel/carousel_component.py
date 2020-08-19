import param

from nick_derobertis_site.common.component import HTMLComponent
from .carousel_model import CarouselModel


class CarouselComponent(HTMLComponent):
    model = param.ClassSelector(class_=CarouselModel)


